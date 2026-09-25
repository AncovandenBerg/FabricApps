import type { ComponentType, SVGProps } from 'react';
import DataFactory from '@fabric-msft/svg-icons/DataFactory48Color';
import DataEngineering from '@fabric-msft/svg-icons/DataEngineering48Color';
import DataScience from '@fabric-msft/svg-icons/DataScience48Color';
import DataWarehouse from '@fabric-msft/svg-icons/DataWarehouse48Color';
import RealTimeIntelligence from '@fabric-msft/svg-icons/RealTimeIntelligence48Color';
import PowerBi from '@fabric-msft/svg-icons/PowerBi48Color';
import Databases from '@fabric-msft/svg-icons/Databases48Color';
import OneLake from '@fabric-msft/svg-icons/OneLake48Color';

export interface Workload {
  id: string;
  name: string;
  /** One or two sentences — what the workload actually is. */
  description: string;
  /** Concrete, plain-language examples of what people use it for. */
  useCases: string[];
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
}

// These are Fabric's actual workloads/experiences (the categories in the
// experience switcher) — not the individual item types you create inside
// them (a Lakehouse, a Notebook, a Report, ...). OneLake is the one
// exception: it's not in the experience switcher, but it's included here
// as the unifying storage layer every other spoke writes into.
export const WORKLOADS: Workload[] = [
  {
    id: 'data-factory',
    name: 'Data Factory',
    description:
      "Fabric's data integration and orchestration engine. Connect to hundreds of sources and move data at scale, mostly without writing code.",
    useCases: [
      'Pulling data from SaaS apps, databases, and APIs into Fabric',
      'Scheduling and monitoring recurring data movement',
      'Transforming data in-flight with low-code dataflows',
    ],
    Icon: DataFactory,
  },
  {
    id: 'data-engineering',
    name: 'Data Engineering',
    description:
      'Spark-based notebooks and pipelines for engineers who want full code control over large-scale data transformation.',
    useCases: [
      'Writing PySpark transformations on lakehouse data',
      'Building and testing reusable data pipelines',
      'Processing data too large to handle on a single machine',
    ],
    Icon: DataEngineering,
  },
  {
    id: 'data-warehouse',
    name: 'Data Warehouse',
    description:
      'A full T-SQL data warehouse, built on the same open Delta Lake format as the rest of Fabric. No separate copy of your data.',
    useCases: [
      'Running traditional SQL-based reporting and analytics',
      'Serving BI tools that expect a relational warehouse',
      'Enforcing strong schema and governance on curated data',
    ],
    Icon: DataWarehouse,
  },
  {
    id: 'data-science',
    name: 'Data Science',
    description:
      'An environment for training, tracking, and deploying machine learning models right next to the data that feeds them.',
    useCases: [
      'Training and experimenting with ML models on Fabric data',
      'Tracking experiments and comparing model versions',
      'Scoring predictions directly against production data',
    ],
    Icon: DataScience,
  },
  {
    id: 'real-time-intelligence',
    name: 'Real-Time Intelligence',
    description:
      'Ingest, query, and react to streaming and event data the moment it arrives, not hours later in a batch job.',
    useCases: [
      'Monitoring IoT sensors or application telemetry live',
      'Querying high-velocity event data with KQL',
      'Triggering alerts and automated actions on incoming events',
    ],
    Icon: RealTimeIntelligence,
  },
  {
    id: 'databases',
    name: 'Databases',
    description:
      'Fully managed operational databases (SQL, Cosmos DB, and mirrored databases) that live inside Fabric alongside your analytics.',
    useCases: [
      'Running transactional application workloads',
      'Mirroring existing databases into Fabric for analytics, with no ETL',
      'Keeping operational and analytical data on the same platform',
    ],
    Icon: Databases,
  },
  {
    id: 'power-bi',
    name: 'Power BI',
    description:
      'The reporting and dashboarding layer people already know, reading straight off the same governed data with no separate copy.',
    useCases: [
      'Building interactive reports and dashboards',
      'Sharing insights across the business',
      'Self-service analytics for non-technical users',
    ],
    Icon: PowerBi,
  },
  {
    id: 'onelake',
    name: 'OneLake',
    description:
      "Fabric's built-in, tenant-wide data lake. Every workload reads and writes the same Delta/Parquet files here, no copies, no separate storage account to provision.",
    useCases: [
      'Storing every Lakehouse, Warehouse, and dataset in one open format',
      'Shortcutting to data in ADLS, S3, or another workspace without copying it',
      'Giving every workload instant access to the same governed data',
    ],
    Icon: OneLake,
  },
];
