# UMD Context Injection — Implementation Plan

> **Reader note (Cursor Auto model):** Execute this plan **one phase at a time, in order**. Do not skip ahead. Every constant, path, key name, and prompt string in this document is a locked decision — do not substitute, rename, or "improve" them. If something conflicts with your instincts, trust the plan. When in doubt, re-read this file.

---

## 0. What This Feature Does (context, do not implement)

Ricochet is an AI brainstorming tool where two agents (Visionary + Critic) debate a topic. This feature adds an **optional searchable dropdown** to the session creation form that lets the user select a UMD-specific context (e.g., "Hackathon," "QUEST Project," "Pitch"). When selected, a tailored prompt paragraph is appended to the system prompt of all three agents (Visionary, Critic, Judge), giving them grounded knowledge about that UMD program/context.

**Locked decisions:**
- Context is selected **once at session creation** and cannot be changed mid-session.
- Only **one** context can be selected per session (no multi-select).
- There is **no** "Custom" free-text option — only the predefined list below.
- Context selection is **optional** — default is null (no context injected).
- The selected context label **must appear as a badge** in the session view UI so the user can see which context is active during the debate.

---

## 1. New Data Flow

```
TopicForm (client)
  ├── topic         (existing — string)
  ├── ideaCount     (existing — number)
  └── contextType   (NEW — string | null, default null)
        │
        ▼
POST /api/session body: { topic, ideaCount, contextType }
        │
        ▼
createSession(topic, ideaCount, contextType)  →  Session object stores contextType
        │
        ▼
buildVisionaryMessages / buildCriticMessages / buildJudgeMessages
  └── if session.contextType !== null:
        append "\n\n--- UMD CONTEXT ---\n" + CONTEXT_PROMPTS[session.contextType]
        to the END of the system prompt string (before the messages array)
```

---

## 2. Files to Create

### 2.1 `lib/context/umd.ts`

This file exports three things:

```ts
// 1. The list of options for the dropdown UI
export const CONTEXT_OPTIONS: Array<{
  value: string;   // key used in CONTEXT_PROMPTS and stored on Session
  label: string;   // display label in dropdown
  category: string; // group header in dropdown
}> = [ /* see §4 for exact entries */ ];

// 2. The prompt strings keyed by value
export const CONTEXT_PROMPTS: Record<string, string> = { /* see §5 for exact entries */ };

// 3. Helper function used by agent files
export function getContextPrompt(contextType: string | null): string | null {
  if (contextType === null) return null;
  return CONTEXT_PROMPTS[contextType] ?? null;
}
```

### 2.2 `components/ContextSelect.tsx`

A searchable combobox component. **Requires installing shadcn Command + Popover first** (see Phase 4 step 1).

Props interface:
```ts
interface ContextSelectProps {
  value: string | null;
  onChange: (value: string | null) => void;
}
```

Behavior:
- Renders a button trigger styled like the existing form inputs (see §7 for exact classes).
- When `value` is null, button text is: `"None — general brainstorming"`
- When `value` is set, button text is the matching `label` from `CONTEXT_OPTIONS`.
- Clicking the button opens a Popover containing a Command component.
- The Command has a search input (placeholder: `"Search UMD contexts..."`) and items grouped by `category`.
- Selecting an item calls `onChange(item.value)` and closes the popover.
- An `X` icon button next to the trigger resets to `onChange(null)` (only visible when value is non-null).
- Empty search state text: `"No matching context found"`
- The `"None"` option does NOT appear in the dropdown list — clearing is done via the X button only.

---

## 3. Files to Modify

### 3.1 `lib/session/types.ts`

Add `contextType` to the `Session` type. Place it after `ideaCount`:

```ts
// BEFORE (line exists):
ideaCount: number;
// ADD THIS LINE DIRECTLY AFTER:
contextType: string | null;
```

No other changes to this file.

### 3.2 `lib/session/store.ts`

Change the `createSession` function signature and body:

```ts
// BEFORE:
export function createSession(topic: string, ideaCount: number): Session {
// AFTER:
export function createSession(topic: string, ideaCount: number, contextType: string | null): Session {
```

Add `contextType` to the session object literal, after `ideaCount`:

```ts
contextType,
```

No other changes to this file.

### 3.3 `lib/agents/visionary.ts`

At the top, add import:
```ts
import { getContextPrompt } from "@/lib/context/umd";
```

In `buildVisionaryMessages`, after the existing `.replace("{N}", ...)` chain, append context:
```ts
const contextPrompt = getContextPrompt(session.contextType);
const systemWithContext = contextPrompt
  ? system + "\n\n--- UMD CONTEXT ---\n" + contextPrompt
  : system;
return [{ role: "system", content: systemWithContext }, ...turnsToMessages(session.turns)];
```

Replace the existing `return [{ role: "system", content: system }, ...` line with the above.

### 3.4 `lib/agents/critic.ts`

Exact same pattern as visionary.ts (§3.3). Import `getContextPrompt`, append to system prompt, update the return.

### 3.5 `lib/agents/judge.ts`

Exact same pattern as visionary.ts (§3.3). Import `getContextPrompt`, append to system prompt in `buildJudgeMessages`, update the return.

### 3.6 `app/api/session/route.ts`

Parse `contextType` from the POST body. Add this after the `ideaCount` parsing block:

```ts
const rawContextType =
  typeof body === "object" &&
  body !== null &&
  "contextType" in body &&
  typeof (body as { contextType: unknown }).contextType === "string"
    ? (body as { contextType: string }).contextType
    : null;
```

Import `CONTEXT_OPTIONS` from `@/lib/context/umd` and validate:
```ts
import { CONTEXT_OPTIONS } from "@/lib/context/umd";
```

After the `ideaCount` validation block, add:
```ts
const contextType =
  rawContextType !== null && CONTEXT_OPTIONS.some((o) => o.value === rawContextType)
    ? rawContextType
    : null;
```

Update the `createSession` call:
```ts
const session = createSession(topic, ideaCount, contextType);
```

### 3.7 `components/TopicForm.tsx`

Add state:
```ts
const [contextType, setContextType] = useState<string | null>(null);
```

Add to the `fetch` body:
```ts
body: JSON.stringify({ topic, ideaCount, contextType }),
```

Add `<ContextSelect>` between the topic textarea `<div>` and the idea count `<div>`:
```tsx
import { ContextSelect } from "@/components/ContextSelect";
```
```tsx
<div className="flex flex-col gap-2">
  <label className="text-sm font-medium text-neutral-300">
    UMD Context (optional)
  </label>
  <ContextSelect value={contextType} onChange={setContextType} />
</div>
```

### 3.8 `app/session/[id]/page.tsx`

Add a context badge to the session view. This file renders the active session page. Add a small badge/pill near the top of the session view that shows the selected context label. It should:
- Only render when the session has a non-null `contextType`
- Display the human-readable label (look up from `CONTEXT_OPTIONS` by value)
- Use muted styling: `text-xs bg-neutral-800 text-neutral-300 rounded-full px-3 py-1`
- Be positioned near the topic/header area so the user can see what context is active

Read the existing file first to determine the exact placement. The badge should be visually subtle — it is informational, not interactive.

---

## 4. CONTEXT_OPTIONS (exact values)

These are the exact entries for the `CONTEXT_OPTIONS` array in `lib/context/umd.ts`. Use these values verbatim:

```ts
export const CONTEXT_OPTIONS = [
  // Programs & Research
  { value: "startup-shell",     label: "Startup Shell",                                  category: "Programs & Research" },
  { value: "fire",              label: "FIRE (First-Year Innovation & Research Experience)", category: "Programs & Research" },
  { value: "gemstone",          label: "GEMSTONE",                                        category: "Programs & Research" },
  { value: "undergrad-research", label: "Undergrad Research",                             category: "Programs & Research" },
  { value: "quest",             label: "QUEST Project",                                   category: "Programs & Research" },
  { value: "honors-project",    label: "Honors Project",                                  category: "Programs & Research" },

  // Academic Work
  { value: "thesis-direction",    label: "Thesis Direction",                    category: "Academic Work" },
  { value: "presentations",      label: "Presentations",                       category: "Academic Work" },
  { value: "essay",              label: "Essay",                               category: "Academic Work" },
  { value: "policy-proposal",    label: "Policy Proposal",                     category: "Academic Work" },
  { value: "assignment-creation", label: "Assignment Creations (For Teachers)", category: "Academic Work" },

  // Entrepreneurship & Career
  { value: "pitch",    label: "Pitch",          category: "Entrepreneurship & Career" },
  { value: "job-app",  label: "Job App Angle",  category: "Entrepreneurship & Career" },
  { value: "branding", label: "Branding",       category: "Entrepreneurship & Career" },
  { value: "do-good",  label: "Do Good Project", category: "Entrepreneurship & Career" },

  // Building & Creating
  { value: "hackathon", label: "Hackathon", category: "Building & Creating" },
  { value: "app",       label: "App",       category: "Building & Creating" },
  { value: "media",     label: "Media",     category: "Building & Creating" },
] as const;
```

---

## 5. CONTEXT_PROMPTS (exact values)

These are the exact prompt strings for `CONTEXT_PROMPTS` in `lib/context/umd.ts`. Each key matches a `value` from `CONTEXT_OPTIONS`. Copy these verbatim — do not rephrase, shorten, or "improve" them.

### `pitch`
```
The user is brainstorming a pitch. Tailor ideas to the UMD pitch ecosystem:
- UMD has an active pitch culture through the Dingman Center for Entrepreneurship (Robert H. Smith School of Business), Terp Tank (campus-wide Shark Tank-style pitch competition with cash prizes), and the Hinman CEOs (Center for Entrepreneurship and Opportunity) living-learning program.
- Startup Shell is a major student-run 501(c)(3) incubator on campus where members regularly pitch to each other and to external mentors. Members must pitch their startup idea to gain admission.
- The Entrepreneurship & Innovation Program (EIP) is an Honors College living-learning program that feeds into the broader pitch pipeline.
- Common pitch venues include Maryland Day demos, Dingman Center competitions (Pitch Dingman), Do Good Challenge, and the Mtech Venture Fund.
- UMD pitches often emphasize social impact alongside commercial viability, reflecting the Do Good Institute's influence.
- Judges at UMD pitch competitions typically include Smith School faculty, local DC/Baltimore/NoVA-area investors, and alumni entrepreneurs. Proximity to DC means access to government and defense-tech startup ecosystems.
- Frame ideas in terms of: problem, solution, market, traction, and ask — the standard Dingman format.
```

### `startup-shell`
```
The user is working on something related to Startup Shell, UMD's premier student-run startup incubator:
- Startup Shell is a co-working community and pre-accelerator housed on the UMD campus. Members include founders, developers, designers, and business students. It is a 501(c)(3) nonprofit run entirely by students.
- The culture is collaborative and peer-driven — members give each other brutally honest feedback in a supportive environment. Weekly "Shell Talks" feature member demos and guest speakers.
- Startup Shell teams often go through Dingman Center programs, apply to Y Combinator, Techstars, or other accelerators. Several alumni startups have raised significant funding.
- Members range across all colleges — CS, engineering, business, arts. Cross-disciplinary teams are the norm.
- Shell operates on a semester application cycle and has a selective admissions process where applicants must pitch their startup idea. Active participation and shipping product is valued over credentials.
- Ideas should be framed as buildable MVPs with clear user validation paths — Shell culture favors "launch fast, learn fast."
```

### `fire`
```
The user is working on something related to FIRE, UMD's First-Year Innovation & Research Experience:
- FIRE is a multi-semester research program for freshmen and sophomores that places students into faculty-led research "streams" organized around specific topics (e.g., "Autonomous Unmanned Systems," "Simulating Sustainability," "Political Analytics," "Polymers and Composites," cybersecurity, machine learning, genomics).
- Each stream has a faculty "stream leader," graduate student mentors, and peer mentors (often FIRE alumni returning as teaching fellows). Students work in small teams on real research questions.
- FIRE is structured as a course sequence: FIRE120 (Fall intro/methods), FIRE198 (Spring hands-on research), and optional FIRE298 (sophomore year continued research).
- Students present their research at the FIRE Summit at the end of each academic year.
- FIRE is housed within the Honors College but open to non-Honors students as well.
- Ideas should consider: What research question does this address? What data or methods are involved? How does this fit into a semester timeline? What would a poster presentation look like?
```

### `gemstone`
```
The user is working on something related to Gemstone, UMD's Honors living-learning program:
- Gemstone is a four-year, multidisciplinary research program within the Honors College. Students form teams of 10-15 in their freshman year and work on a single team research project through senior year, culminating in a thesis.
- Each team has a faculty mentor and a librarian liaison. The thesis must be an original contribution to knowledge.
- Gemstone emphasizes teamwork, communication, and research methodology across all four years. There are dedicated courses each semester (GEMS courses in research methods, technical writing, etc.).
- Teams defend their thesis in a formal "Thesis Conference" (Team Thesis Day) during senior year before a "citation panel" of external experts.
- The program is housed in the Honors College and part of the living-learning community in Prince Frederick Hall.
- Ideas should be scoped for multi-year, team-based research. Consider: What's the research question? What disciplines does it span? What would a 4-year timeline look like? How does the team divide work?
```

### `undergrad-research`
```
The user is brainstorming around undergraduate research at UMD:
- UMD's Office of Undergraduate Research (formerly OURSA) helps students find mentors, funding, and present their work. UMD is a Carnegie R1 research institution — undergrad research is a pillar of the university's identity.
- Key programs: FIRE (first-year), Gemstone (four-year), individual mentored research (often through departmental honors programs), and summer REUs.
- Funding sources include: the Dean's Research Fund, Maryland Summer Scholars, URAP (Undergraduate Research Assistantship Program), Undergraduate Research Award, and HHMI grants for STEM students. Travel grants are available for conference presentations.
- Students present at: Maryland Day, the Undergraduate Research Symposium (Undergraduate Research Day), and discipline-specific conferences.
- Finding mentors: students can use the OURSA faculty database, approach professors directly, or get matched through FIRE. Cold-emailing faculty is common and encouraged.
- Ideas should consider: advisor/mentor fit, IRB or safety approvals if applicable, poster vs. paper deliverables, and whether this feeds into grad school applications.
```

### `thesis-direction`
```
The user is brainstorming thesis directions at UMD:
- UMD undergrad theses typically come through Gemstone (team thesis), departmental honors programs (individual thesis), or the Honors College capstone.
- A strong thesis at UMD has: a clear research question, a literature review grounding it in existing work, a defined methodology, and original analysis or findings.
- Gemstone theses are team-based and multidisciplinary; departmental theses are individual and discipline-specific.
- Students work with a faculty advisor and often a thesis committee. The Honors College requires a formal defense.
- Consider: What gap in existing research does this fill? Is the scope achievable in 1-2 semesters of focused work? What data sources or experimental methods are available at UMD?
- UMD has strong research infrastructure: libraries, labs, computing clusters (Zaratan HPC), and inter-departmental collaboration opportunities.
```

### `quest`
```
The user is working on a QUEST project at UMD:
- QUEST (Quality Enhancement Systems and Teams) is a selective honors program spanning the Clark School of Engineering, Smith School of Business, College of Computer, Mathematical, and Natural Sciences, and the School of Public Policy.
- QUEST is structured around three courses: BMGT/ENES 190H (Intro), a 300-level course, and QUEST 490 (capstone). The capstone involves a real-world client project.
- The program emphasizes systems thinking, process improvement, lean/six sigma methodologies, data-driven decision making, and cross-functional teamwork. The intellectual foundation is rooted in W. Edwards Deming's quality philosophy.
- Capstone teams work with actual corporate or nonprofit clients to solve real business problems. Past clients have included companies like Under Armour, Lockheed Martin, Northrop Grumman, and Capital One.
- QUEST students ("QUEST Fellows") are known for strong analytical and presentation skills — deliverables typically include both a written report and a formal client presentation.
- Ideas should be framed around: measurable impact, process improvement, stakeholder analysis, and actionable recommendations.
```

### `honors-project`
```
The user is working on a project within UMD's Honors College:
- The Honors College at UMD includes multiple programs: University Honors (UH), Gemstone (research), Integrated Life Sciences (ILS), Design Cultures & Creativity (DCC), Entrepreneurship & Innovation Program (EIP), and others.
- Honors students take Honors seminars (HONR courses) — small, discussion-based classes on varied topics (e.g., "The Science of Happiness," "Zombies in Popular Media").
- To graduate "with Honors," University Honors students must complete a capstone Honors project — typically a thesis, creative work, or research project done under faculty supervision.
- The Honors College has dedicated living-learning communities in residence halls (Hagerstown Hall, Prince Frederick Hall, etc.) and provides priority registration, dedicated advising, and Honors study lounges.
- Honors projects should demonstrate intellectual ambition, interdisciplinary thinking, and a clear contribution — whether creative, analytical, or applied.
- Consider: Which Honors program is this for? What are the specific requirements? Does this connect to a broader research agenda or creative portfolio?
```

### `presentations`
```
The user is preparing a presentation at UMD:
- Major presentation venues at UMD include: Maryland Day (campus-wide open house with student showcases, 60,000+ visitors), the Undergraduate Research Symposium, FIRE Summit, Gemstone Thesis Conference, and QUEST capstone presentations.
- UMD's Communication Center (part of the Writing Center) offers coaching on presentations and public speaking.
- Presentation culture at UMD varies by context: STEM presentations favor data-driven posters and slides, business presentations (Smith School) favor polished decks with clear takeaways, and humanities/social science presentations favor narrative-driven talks.
- For poster presentations: UMD standard is typically 48"x36", printed through departmental resources or the Terrapin Tech store.
- Consider the audience: Is this for faculty evaluators, peers, industry judges, or the general public (Maryland Day)?
- Strong UMD presentations blend substance with accessibility — heavy jargon is discouraged even in technical contexts.
```

### `essay`
```
The user is working on an essay at UMD:
- UMD's Writing Center (located in Tawes Hall) offers free tutoring for all stages of the writing process — brainstorming, drafts, and revision.
- The Professional Writing program (English department) is one of the strongest in the region and influences writing standards across campus.
- Common essay types at UMD: argumentative essays (most courses), research papers, reflective essays (Honors seminars), policy memos (School of Public Policy), case analyses (Smith School), and lab reports (STEM). ENGL 101 (Academic Writing) is the universal first-year writing requirement.
- UMD uses various citation styles depending on discipline: APA (social sciences, education), MLA (humanities), Chicago (history), IEEE (engineering).
- UMD's "I-Series" courses (cross-disciplinary courses tagged with an "I" prefix) often require substantial analytical essays.
- Ideas should consider: What's the argument or thesis statement? What evidence is available? Who is the audience? What disciplinary conventions apply?
```

### `policy-proposal`
```
The user is working on a policy proposal at UMD:
- UMD's School of Public Policy (housed in Van Munching Hall) is one of the top public policy programs in the country, with particular strengths in international policy, environmental policy, and technology policy.
- The school runs policy workshops and studios where students develop real policy proposals for government and nonprofit clients. Policy courses (e.g., PLCY 201, PLCY 388) require formal policy memos and briefs.
- Common format: Executive summary, problem statement, background/context, policy options (usually 3), analysis of each option (cost, feasibility, equity, political viability), recommendation, and implementation plan.
- UMD's proximity to Washington, D.C. is a major asset — students often engage with federal agencies, think tanks (Brookings, Urban Institute, CSIS), and congressional offices.
- The Do Good Institute often intersects with policy work, framing proposals around social impact. The Student Government Association (SGA) also regularly drafts policy proposals to university administration.
- Consider: What level of government is this targeting? What data supports the problem? What are the political constraints? Who are the stakeholders?
```

### `do-good`
```
The user is working on a Do Good project at UMD:
- The Do Good Institute (part of the College of Information Studies) is UMD's hub for social impact and civic engagement. It funds student projects, runs pitch competitions, and offers courses on social entrepreneurship.
- The Do Good Challenge is an annual campus-wide competition where student teams pitch social impact ventures. Winners receive funding (up to $10K-$20K+) and mentorship.
- The Do Good Accelerator is a semester-long program providing mentorship, workshops, and seed funding for student-led social ventures.
- Do Good projects must demonstrate: a clear social problem, an innovative approach, evidence of community engagement, measurable impact metrics, and a sustainability plan.
- The institute connects students with nonprofits, government agencies, and social enterprises in the DC/Baltimore area.
- Ideas should be framed around: Who benefits? How is impact measured? What makes this approach different from existing solutions? How does this sustain itself beyond a semester?
```

### `assignment-creation`
```
The user is creating assignments or course materials, likely as a TA, instructor, or faculty member at UMD:
- UMD's Teaching and Learning Transformation Center (TLTC) provides resources on pedagogy, course design, and assessment. They run workshops and consultations for TAs and faculty. The Kirwan Center for Academic Innovation supports technology-enhanced assignment design.
- The Graduate School's TA Training requires new teaching assistants to complete orientation sessions covering syllabus design, assessment strategies, and classroom management.
- Common assignment types at UMD: problem sets, lab reports, discussion posts (via ELMS/Canvas), group projects, presentations, reflective journals, case studies, and research papers.
- UMD uses ELMS (Canvas) as its LMS — assignments are typically submitted and graded through ELMS. Turnitin is available for plagiarism detection.
- The university emphasizes inclusive pedagogy and Universal Design for Learning (UDL) principles.
- Effective UMD assignments often include: clear learning objectives tied to course goals, detailed rubrics, scaffolded steps for complex projects, and opportunities for peer review.
```

### `job-app`
```
The user is brainstorming around job applications with a UMD angle:
- UMD's University Career Center & The President's Promise provides resume reviews, mock interviews, and networking events. Each college also has its own career office (Clark School, Smith School's Office of Career Services, etc.).
- UMD uses Handshake as its primary job/internship platform. Many employers recruit directly through UMD career fairs (Engineering Career Fair, Smith School networking nights, etc.).
- UMD's location near DC is a massive advantage for government, policy, consulting, defense/intel, and nonprofit careers. Key employers: federal agencies (NSA, NASA Goddard, NIH), defense contractors (Lockheed Martin, Northrop Grumman), Big 4 firms, and major tech companies.
- Key UMD strengths to highlight: top CS/engineering program, proximity to DC, strong alumni network (400,000+ strong, especially dense in DMV area), research experience, and diversity.
- For tech jobs: highlight projects, hackathon wins (Bitcamp, Technica), GitHub contributions, and relevant coursework (CMSC courses, data science minor).
- Consider: What's the target industry? What UMD experiences are most relevant? How does the user's story connect their UMD experience to the role?
```

### `branding`
```
The user is brainstorming personal or project branding with a UMD angle:
- UMD's brand identity centers on: "Fearlessly Forward," the Terrapin mascot (Testudo — students rub the statue's nose for good luck), and school colors (Maryland red, white, black, gold — the Crossland banner / Maryland flag pattern).
- UMD is known for: strong STEM programs (especially CS, engineering, and physical sciences — cybersecurity is ranked #1-2 nationally), proximity to DC, Big Ten athletics, research output, and diversity.
- The "Terp" identity is strong — alumni network is active especially in the DC/Baltimore corridor, and "Terp" branding resonates in the mid-Atlantic tech and government ecosystem. Terrapins Connect is the alumni networking platform.
- For personal branding: UMD students often leverage their unique combination of research experience, DC-area internships, and the "Do Good" ethos.
- For project/startup branding: consider whether to lean into the UMD connection (good for campus-focused products, alumni-network plays) or keep it universal.
- Key differentiators to lean into: "flagship state university," "R1 research institution," Big Ten membership, Do Good ethos, and proximity to federal agencies and embassies.
```

### `hackathon`
```
The user is brainstorming for a hackathon, likely at or related to UMD:
- Bitcamp is UMD's flagship hackathon — one of the largest on the East Coast. It's a 36-hour event held annually, typically in spring at the Xfinity Center, with 1000+ participants. Themes vary by year; projects are judged on creativity, technical complexity, polish, and impact.
- Technica is UMD's hackathon focused on underrepresented genders in tech — one of the largest of its kind nationally (2,000+ participants). Similar format to Bitcamp with a focus on inclusivity and beginner-friendly tracks.
- HackUMD is a smaller, UMD-community-focused hackathon that serves as an entry point for first-time hackers.
- Hackathon projects at UMD tend to win when they: solve a real problem, have a working demo (not just slides), use an interesting technical approach, and tell a compelling story during judging. MLH partners with UMD hackathons for hardware, APIs, and official prizes.
- Common tech stacks: React/Next.js, Python/Flask, Firebase, various APIs (OpenAI, Twilio, Google Cloud). Hardware hacks are also popular at Bitcamp.
- Consider: What's the hackathon theme/tracks? What sponsor prizes are available? What APIs/tools are provided? Can this be built in 24-36 hours? What makes the demo impressive?
```

### `app`
```
The user is brainstorming an app, likely in a UMD context:
- UMD's CS department (housed in the Brendan Iribe Center for Computer Science and Engineering) is one of the top programs nationally. Relevant courses: CMSC320 (Data Science), CMSC434 (Human-Computer Interaction), CMSC435 (Software Engineering), CMSC436 (Mobile Development), and CMSC388/498 special topics (often student-proposed: React, Flutter, Rust, cloud computing).
- App development clubs at UMD: Google Developer Student Club (GDSC), App Development Club, Hack4Impact (builds apps for nonprofits), and project teams within Startup Shell.
- UMD-specific app opportunities: campus navigation, dining hall menus, shuttle tracking, study space finder, course planning tools, and student org discovery. The campus has ~40,000 students — a built-in user base.
- Distribution channels: UMD social media, Reddit (r/UMD), student orgs, and Maryland Day demos.
- For class projects (CMSC434/435): apps need user research, wireframes, usability testing, and iterative design. Grading emphasizes process as much as product.
- Consider: Who's the user? What's the core loop? How does this get distribution? Is this a class project, a hackathon build, or a real product?
```

### `media`
```
The user is brainstorming a media project at UMD:
- The Diamondback is UMD's independent student newspaper — one of the most prominent college papers nationally. It covers campus news, sports, and investigative reporting, and operates independently from the university.
- UMD's Philip Merrill College of Journalism is one of the top journalism schools in the country, with strong programs in multimedia journalism, broadcast, and data journalism. Its building, Knight Hall, has TV studios and editing suites.
- The Howard Center for Investigative Journalism at Merrill involves students in long-form investigative projects that have won national awards, including Pulitzer Prize contributions.
- Capital News Service is a student-staffed news wire that provides real content to Maryland news outlets — students report real stories for real audiences.
- Student media organizations include: The Diamondback, WMUC Radio (88.1 FM — one of the oldest college radio stations in the country), Left of Center Magazine, Terrapin TV, and various podcasts.
- UMD's proximity to DC provides access to newsmakers, events, and major media outlets (Washington Post, NPR, Politico) for internships and sourcing.
- Consider: What medium (print, audio, video, social, interactive)? Who is the audience? What's the editorial angle? How does this leverage UMD's resources or location?
```

---

## 6. Implementation Phases (execute in order)

### Phase 1: Data Layer

**Step 1.** Create `lib/context/umd.ts` with the exact `CONTEXT_OPTIONS`, `CONTEXT_PROMPTS`, and `getContextPrompt` from §2.1, §4, and §5.

**Step 2.** Edit `lib/session/types.ts` — add `contextType: string | null;` to the `Session` type, directly after the `ideaCount: number;` line.

**Step 3.** Edit `lib/session/store.ts` — change `createSession` signature to accept `contextType: string | null` as a third parameter, and include `contextType` in the session object literal.

### Phase 2: Prompt Injection

**Step 4.** Edit `lib/agents/visionary.ts` — import `getContextPrompt` from `@/lib/context/umd`, and in `buildVisionaryMessages`, append the context prompt to the system string if non-null (see §3.3 for exact code).

**Step 5.** Edit `lib/agents/critic.ts` — same pattern as Step 4.

**Step 6.** Edit `lib/agents/judge.ts` — same pattern as Step 4.

### Phase 3: API

**Step 7.** Edit `app/api/session/route.ts` — import `CONTEXT_OPTIONS`, parse and validate `contextType` from the POST body, pass it to `createSession` (see §3.6 for exact code).

### Phase 4: UI — Topic Form

**Step 8.** Run `npx shadcn@latest add command popover` to install the required shadcn components.

**Step 9.** Create `components/ContextSelect.tsx` — the searchable combobox (see §2.2 for full spec).

**Step 10.** Edit `components/TopicForm.tsx` — add `contextType` state, render `<ContextSelect>`, include `contextType` in the POST body (see §3.7 for exact code).

### Phase 5: UI — Session Badge

**Step 11.** Edit `app/session/[id]/page.tsx` — read the file first to understand its structure, then add a context badge that displays the selected context label when `contextType` is non-null (see §3.8 for spec).

### Phase 6: Verify

**Step 12.** Run `npm run build` to verify there are no TypeScript errors.

**Step 13.** Start the dev server and test: create a session with a context selected, verify the agents reference UMD-specific knowledge in their debate. Also verify that creating a session with no context selected works normally (no regression).

---

## 7. Styling Reference

All new UI elements must match the existing dark theme. Here are the exact classes used in the existing form inputs (from `components/TopicForm.tsx`):

**Input/trigger styling:**
```
focus-visible:ring-amber-400 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 placeholder:text-neutral-500 focus-visible:outline-none focus-visible:ring-2
```

**Label styling:**
```
text-sm font-medium text-neutral-300
```

**Context badge styling (for session view):**
```
text-xs bg-neutral-800 text-neutral-300 rounded-full px-3 py-1
```

**Icons available:** `lucide-react` is already installed. Use `Search` for search input, `X` for clear button, `ChevronDown` for dropdown trigger.
