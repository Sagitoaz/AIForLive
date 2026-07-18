# EduRecall Personalization AI Service

FastAPI exposes a single aggregate endpoint, `POST /v1/personalization/analyze-event`. It combines mastery update, recall-risk estimation, registered domain diagnosis and recommendation scoring. It does not connect to the business database.

```powershell
npm run ai:install
npm run ai:data
npm run ai:train
npm run dev:ai
```

The shipped model is trained exclusively on deterministic synthetic data and is appropriate only for demonstrating the architecture.
