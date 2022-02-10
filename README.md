# Happyhour CLI

## Installation

```bash
npm install -g https://github.com/healthline/happyhour-node-cli.git
happyhour init
```

## Usage

Keep happyhour running in a terminal from the root of your work directory.

```bash
cd sites # or work or whatever dir contains all your projects
happyhour watch
```

Follow the JIRA-ticket/feature-description branching convention whenever creating new branches:

```bash
git checkout HLPJ-321/my-new-feature
```

Happyhour will track all your time spent working on that Jira ticket. If work on a single ticket spans multiple repos, follow the same convention:

```bash
cd platejoy
git checkout HLPJ-321/hello-world
cd ../platejoy_admin
git checkout HLPJ-321/goodbye
```

Happyhour will then track time from both repos toward the same Jira ticket.
