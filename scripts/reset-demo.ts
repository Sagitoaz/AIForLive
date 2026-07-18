async function main(): Promise<void> {
  const endpoint = `${process.env.API_URL ?? "http://localhost:4000/api"}/health/demo-reset`;
  try {
    const response = await fetch(endpoint, { method: "POST" });
    if (!response.ok) throw new Error(`API ${response.status}`);
    console.log("In-memory demo state reset. Clear browser local storage with the Reset demo button on /login.");
  } catch {
    console.log("API is not running. Database seed is idempotent; run npm run db:seed, then use Reset demo on /login.");
  }
}

void main();
