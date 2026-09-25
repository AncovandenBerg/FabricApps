import {
  UserDataFunctions,
  AudienceType,
  type RayfinContext,
} from '@microsoft/fabric-user-data-functions';
import sql from 'mssql';

const udf = new UserDataFunctions();

// Parked: Fabric doesn't yet support deploying Rayfin Functions to
// production (a 400 at deploy time, not a bug here), so the app reads
// precomputed static exports instead (see src/lib/windFingerprint/
// staticFingerprint.ts) and this function is never called. Fill these in
// from your own Fabric Portal -> Lakehouse -> Settings -> SQL analytics
// endpoint if you ever revive it -- don't hardcode a real endpoint here.
const SQL_SERVER = '<your-lakehouse>.datawarehouse.fabric.microsoft.com';
const DATABASE = '<your-lakehouse-sql-endpoint-item-guid>';

export type Pollutant = 'NO2' | 'PM10' | 'PM2.5';

export interface FingerprintGridCell {
  sectorIndex: number;
  binSortOrder: number;
  binLabel: string;
  meanConcentration: number;
  n: number;
}

export interface FingerprintCpfSector {
  sectorIndex: number;
  cpf: number;
  n: number;
  exceedances: number;
}

export interface FingerprintResult {
  grid: FingerprintGridCell[];
  cpf: FingerprintCpfSector[];
  threshold: number;
  validHours: number;
}

export interface GetFingerprintInput {
  stationEoi: string;
  pollutant: Pollutant;
  /** ISO date, inclusive. */
  periodStart: string;
  /** ISO date, exclusive. */
  periodEnd: string;
  /** Omit to use an approximate 90th-percentile default (see resolveThreshold). */
  threshold?: number;
}

async function connect(ctx: RayfinContext): Promise<sql.ConnectionPool> {
  const token = ctx.getToken(AudienceType.Sql);
  return sql.connect({
    server: SQL_SERVER,
    database: DATABASE,
    options: { encrypt: true, trustServerCertificate: false },
    authentication: {
      type: 'azure-active-directory-access-token',
      options: { token },
    },
  });
}

// Schema assumed `dbo` (default Lakehouse SQL analytics endpoint behaviour
// when Lakehouse schemas preview is not in use) — confirm once nb_gold
// actually creates these tables. Column names follow the star schema from
// the project's data model (dim_station, dim_pollutant, dim_wind_sector,
// dim_wind_speed_bin, fact_observation).
const FILTERED_OBSERVATIONS_CTE = `
  SELECT
    f.concentration,
    ws.sector_index AS sectorIndex,
    sb.sort_order AS binSortOrder,
    sb.label AS binLabel
  FROM dbo.fact_observation f
  JOIN dbo.dim_station st ON st.station_key = f.station_key
  JOIN dbo.dim_pollutant p ON p.pollutant_key = f.pollutant_key
  JOIN dbo.dim_wind_sector ws ON ws.sector_key = f.sector_key
  JOIN dbo.dim_wind_speed_bin sb ON sb.bin_key = f.speed_bin_key
  WHERE st.eoi_code = @stationEoi
    AND p.code = @pollutant
    AND f.datetime_utc >= @periodStart
    AND f.datetime_utc < @periodEnd
    -- EEA observationvalidity vocabulary: negative codes (-99, -1) = invalid;
    -- all positive codes (1 = valid, 2/3 = valid but below detection limit,
    -- 4 = valid ozone-specific) = valid. Confirmed against
    -- https://dd.eionet.europa.eu/vocabulary/aq/observationvalidity — do not
    -- narrow this to "= 1", that would wrongly drop legitimate low-concentration
    -- (below detection limit) hours and bias every percentile/mean upward.
    AND f.validity_flag > 0
`;

function bindFilterParams(request: sql.Request, input: GetFingerprintInput): void {
  request.input('stationEoi', sql.VarChar(50), input.stationEoi);
  request.input('pollutant', sql.VarChar(10), input.pollutant);
  request.input('periodStart', sql.DateTime2(6), new Date(input.periodStart));
  request.input('periodEnd', sql.DateTime2(6), new Date(input.periodEnd));
}

/**
 * Approximates the 90th percentile with NTILE(100) rather than
 * PERCENTILE_CONT: the Lakehouse SQL analytics endpoint is a more
 * restricted, read-only surface than a full Fabric Warehouse, and
 * PERCENTILE_CONT support there is unconfirmed as of this writing. NTILE is
 * a far more universally supported ranking window function. Revisit once a
 * real endpoint exists to test against.
 */
async function resolveThreshold(
  pool: sql.ConnectionPool,
  input: GetFingerprintInput
): Promise<number> {
  if (input.threshold !== undefined) return input.threshold;

  const request = pool.request();
  bindFilterParams(request, input);
  const result = await request.query(`
    WITH filtered AS (${FILTERED_OBSERVATIONS_CTE}),
    ranked AS (
      SELECT concentration, NTILE(100) OVER (ORDER BY concentration) AS pctBucket
      FROM filtered
    )
    SELECT MIN(concentration) AS p90Threshold FROM ranked WHERE pctBucket = 90;
  `);
  return Number(result.recordset[0]?.p90Threshold ?? 0);
}

udf.func(
  'getFingerprint',
  async (input: GetFingerprintInput, ctx: RayfinContext): Promise<FingerprintResult> => {
    const pool = await connect(ctx);
    try {
      const threshold = await resolveThreshold(pool, input);

      const gridRequest = pool.request();
      bindFilterParams(gridRequest, input);
      const gridResult = await gridRequest.query(`
        WITH filtered AS (${FILTERED_OBSERVATIONS_CTE})
        SELECT sectorIndex, binSortOrder, binLabel,
               AVG(concentration) AS meanConcentration, COUNT(*) AS n
        FROM filtered
        GROUP BY sectorIndex, binSortOrder, binLabel;
      `);

      const cpfRequest = pool.request();
      bindFilterParams(cpfRequest, input);
      cpfRequest.input('threshold', sql.Decimal(10, 3), threshold);
      const cpfResult = await cpfRequest.query(`
        WITH filtered AS (${FILTERED_OBSERVATIONS_CTE})
        SELECT sectorIndex,
               SUM(CASE WHEN concentration > @threshold THEN 1 ELSE 0 END) AS exceedances,
               COUNT(*) AS n
        FROM filtered
        GROUP BY sectorIndex;
      `);

      const validHours = gridResult.recordset.reduce(
        (sum: number, row) => sum + Number(row.n),
        0
      );

      return {
        grid: gridResult.recordset.map((row) => ({
          sectorIndex: Number(row.sectorIndex),
          binSortOrder: Number(row.binSortOrder),
          binLabel: String(row.binLabel),
          meanConcentration: Number(row.meanConcentration),
          n: Number(row.n),
        })),
        cpf: cpfResult.recordset.map((row) => ({
          sectorIndex: Number(row.sectorIndex),
          n: Number(row.n),
          exceedances: Number(row.exceedances),
          cpf: Number(row.n) > 0 ? Number(row.exceedances) / Number(row.n) : 0,
        })),
        threshold,
        validHours,
      };
    } finally {
      await pool.close();
    }
  },
  [udf.connection({ audienceType: AudienceType.Sql })]
);
