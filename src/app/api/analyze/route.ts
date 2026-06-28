import { NextResponse } from 'next/server';

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { jobUrl } = await req.json();
    if (!jobUrl) return NextResponse.json({ error: "jobUrl is required" }, { status: 400 });

    const API_KEY = process.env.ANAKIN_API_KEY;
    if (!API_KEY) return NextResponse.json({ error: "API key is missing" }, { status: 500 });

    // ---------- 1. SCRAPE THE JOB POSTING ----------
    const submitResponse = await fetch('https://api.anakin.io/v1/url-scraper', {
      method: 'POST',
      headers: { 'X-API-Key': API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: jobUrl, country: 'us', useBrowser: true, generateJson: true })
    });
    if (!submitResponse.ok) {
      const err = await submitResponse.json().catch(() => ({}));
      throw new Error(`Scraper rejected request (${submitResponse.status}): ${err.message || 'unknown'}`);
    }
    const { jobId } = await submitResponse.json();
    if (!jobId) throw new Error("No jobId returned from scraper submit");

    let jobData = null;
    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 3000));
      const poll = await fetch(`https://api.anakin.io/v1/url-scraper/${jobId}`, { headers: { 'X-API-Key': API_KEY } });
      const pollData = await poll.json();
      if (pollData.status === 'completed' || pollData.status === 'succeeded') {
        jobData = pollData.data || pollData.result;
        break;
      }
      if (pollData.status === 'failed') throw new Error("Scraping task failed.");
    }
    if (!jobData) throw new Error("Scraping task timed out.");

    const companyName = jobData.company_name || jobData.company || null;
    const postedDate = jobData.posted_date || jobData.date || '';
    const jobTitle = jobData.job_title || jobData.title || 'Unknown Role';

    if (!companyName) {
      return NextResponse.json({
        jobTitle, company: 'Unknown', score: null,
        flags: ["Could not extract a company name from this posting."],
        verdict: "Unable to analyze"
      });
    }

    // ---------- 2. WIRE: TECHCRUNCH ONLY (Trustpilot confirmed down on Anakin's end) ----------
    async function runWireAction(actionId: string, params: Record<string, any>) {
      const submit = await fetch('https://api.anakin.io/v1/wire/task', {
        method: 'POST',
        headers: { 'X-API-Key': API_KEY!, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action_id: actionId, params })
      });
      if (!submit.ok) {
        const err = await submit.json().catch(() => ({}));
        throw new Error(`Wire action ${actionId} rejected (${submit.status}): ${err.message || 'unknown'}`);
      }
      const submitJson = await submit.json();
      const wireJobId = submitJson.job_id;
      if (!wireJobId) throw new Error(`No job_id from ${actionId}`);

      for (let i = 0; i < 10; i++) {
        await new Promise(r => setTimeout(r, 3000));
        const poll = await fetch(`https://api.anakin.io/v1/wire/jobs/${wireJobId}`, { headers: { 'X-API-Key': API_KEY! } });
        const pollJson = await poll.json();
        if (pollJson.status === 'completed') return pollJson.data; // matches confirmed shape: { data: { data: [...], total } }
        if (pollJson.status === 'failed') throw new Error(`${actionId} failed: ${pollJson.error?.message}`);
      }
      throw new Error(`${actionId} timed out`);
    }

    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const afterDate = oneYearAgo.toISOString().split('T')[0];

    const techcrunchData = await runWireAction('tc_search', {
      query: companyName, after: afterDate, limit: 5
    }).catch(e => { console.error('TechCrunch failed:', e.message); return null; });

    // ---------- 3. SCORING ----------
    let ghostScore = 0;
    const flags: string[] = [];

    // Posting age
    const posted = new Date(postedDate);
    const daysOld = isNaN(posted.getTime()) ? null : Math.floor((Date.now() - posted.getTime()) / 86400000);
    if (daysOld !== null) {
      if (daysOld > 30) { ghostScore += 50; flags.push(`Posting is ${daysOld} days old.`); }
      else { flags.push(`Posting is ${daysOld} days old — looks recent.`); }
    } else {
      flags.push("Could not parse posting date.");
    }

    // TechCrunch coverage + recency — real confirmed shape: techcrunchData.data.data, techcrunchData.data.total
    const tcArticles = techcrunchData?.data?.data ?? [];
    const tcTotal = techcrunchData?.data?.total ?? 0;

    if (!techcrunchData) {
      flags.push("Could not verify company news coverage right now.");
    } else if (tcTotal === 0) {
      ghostScore += 30;
      flags.push("No TechCrunch coverage found for this company in the last 12 months.");
    } else {
      const mostRecent = tcArticles[0]?.published ? new Date(tcArticles[0].published) : null;
      const monthsSince = mostRecent ? (Date.now() - mostRecent.getTime()) / (1000 * 60 * 60 * 24 * 30) : null;
      if (monthsSince !== null && monthsSince < 6) {
        flags.push(`${tcTotal} TechCrunch mention(s) found, most recent ${Math.round(monthsSince)} month(s) ago — actively newsworthy.`);
      } else {
        ghostScore += 10;
        flags.push(`${tcTotal} TechCrunch mention(s) found, but nothing recent.`);
      }
    }

    const verdict = ghostScore > 50
      ? "High Risk: This is likely a ghost job. Keep searching."
      : "Low Risk: Active requisition detected. Worth applying!";

    return NextResponse.json({ jobTitle, company: companyName, score: ghostScore, flags, verdict });
  } catch (error: any) {
    console.error("Error in analyze API:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}