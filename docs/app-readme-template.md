# App README template

Copy this into `apps/<app-name>/README.md` and fill it in. Keeping every app on the same shape is what
lets the table in the root README stay accurate, and it makes each app readable on its own if someone
lands there from a search result.

Delete this intro and the HTML comments when you use it.

---

# [[App name]]

> [[One sentence: what question this app answers, and for whom.]]

<!-- Screenshot or a short GIF. Alt text required. Store under ../../docs/img/. -->
![[[Describe what the screenshot shows]]](../../docs/img/[[app-name]].png)

## What it does

[[Two or three sentences. Lead with the thing a visitor can see or do, not the tech.]]

## Data

| | |
| --- | --- |
| **Source** | [[dataset name and link]] |
| **Licence** | [[terms and required attribution]] |
| **Refresh** | [[one-off download, scheduled, or live]] |
| **Size** | [[rough row count or file size]] |

```bash
[[command that fetches or prepares the data]]
```

## How it is built

- **Data model:** [[the entities in rayfin/data, in one line]]
- **Backend:** [[SQL database, GraphQL, what the app reads and writes]]
- **Semantic model:** [[if it binds to a Power BI semantic model over DAX, say so and name it]]
- **Frontend:** [[framework and anything unusual]]

```mermaid
flowchart LR
    [[source]] --> [[storage]] --> [[app]]
```

## Run it locally

```bash
npm install
cp rayfin/.env.example rayfin/.env
npm run dev
```

[[Anything specific to this app: seed data, a longer first build, a dataset that must be downloaded
first.]]

## Deploy

```bash
npx rayfin up --workspace "<your-workspace>"
```

## What I learned

[[The honest section, and the reason anyone reads a showcase repo. What was harder than expected, what
the preview cannot do yet, what you would do differently. Two or three bullets is plenty.]]

## Known limits

- [[what is incomplete or deliberately out of scope]]
