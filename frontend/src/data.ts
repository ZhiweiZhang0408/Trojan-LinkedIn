import type { BoardState, Person } from "./types";
const now = Date.now();
const ago = (days: number) => new Date(now - days * 86400000).toISOString();
const later = (days: number) =>
  new Date(now + days * 86400000).toISOString().slice(0, 10);
const base = {
  school: "USC",
  experience: "",
  education: "",
  projects: "",
  openToConnect: true,
  coffeeChats: true,
  schedulingUrl: "",
};
export const seedPeople: Person[] = [
  {
    ...base,
    id: "alex",
    name: "Alex Kim",
    role: "student",
    email: "alex.kim@usc.edu",
    program: "B.S. Computer Science",
    year: 2027,
    company: "",
    title: "CS junior · Backend and distributed systems",
    location: "Los Angeles, CA",
    bio: "CS junior at USC Viterbi who likes building reliable backend systems. Interned on a logistics data platform, built a Raft key-value store in Go, and works as a student developer for Viterbi IT.",
    skills: [
      "Go",
      "Python",
      "Java",
      "C++",
      "TypeScript",
      "SQL",
      "FastAPI",
      "React",
      "gRPC",
      "Kafka",
      "Redis",
      "PostgreSQL",
      "Docker",
      "Git",
      "Linux",
      "AWS (EC2/S3/RDS)",
      "GitHub Actions",
      "OpenTelemetry",
    ],
    experience:
      "Software Engineering Intern, Ridgeline Logistics (May–Aug 2025): built a Go service streaming 3M shipment events per day from Kafka into PostgreSQL and cut tracking API p95 latency from 480 ms to 190 ms.\nStudent Developer, USC Viterbi IT (Sep 2024–present): built a FastAPI reservation sync for 1,200+ students and cut the nightly job from 40 to 12 minutes.\nCourse Producer, CSCI 104 Data Structures (Jan–May 2025).\nSoftware Lead, Trojan Robotics Club (Jan–Aug 2024).",
    education:
      "University of Southern California, Viterbi School of Engineering — B.S. Computer Science, GPA 3.72, May 2027",
    projects:
      "Distributed Key-Value Store (Go, gRPC): Raft replication across 5 nodes; a fault-injection harness found 3 leader-election bugs.\nTrojanEats (React, TypeScript, PostgreSQL): campus dining app with 600+ weekly users.\nBus Arrival Predictor (Python, scikit-learn): cut prediction error from 4.1 to 2.3 minutes.",
    color: "sand",
  },
  {
    ...base,
    id: "maya",
    name: "Maya Chen",
    role: "alumni",
    email: "maya.chen@alumni.usc.edu",
    program: "MS Computer Science",
    year: 2021,
    company: "Arcwell",
    title: "Senior Data Scientist",
    location: "Los Angeles, CA",
    bio: "Building thoughtful data products at Arcwell. Happy to talk about data careers, the transition from school to industry, and our team’s open roles.",
    skills: ["Data science", "SQL", "Python", "Experimentation"],
    experience: "Data science and experimentation for product teams.",
    color: "rose",
  },
  {
    ...base,
    id: "jordan",
    name: "Jordan Reyes",
    role: "alumni",
    email: "jordan.reyes@alumni.usc.edu",
    program: "BS Business Administration",
    year: 2019,
    company: "Northstar",
    title: "Product Manager",
    location: "San Francisco, CA",
    bio: "Working at the intersection of product, people, and technology. Always glad to meet fellow Trojans interested in product careers.",
    skills: ["Product management", "Analytics", "User research"],
    color: "sage",
  },
  {
    ...base,
    id: "priya",
    name: "Priya Nair",
    role: "alumni",
    email: "priya.nair@alumni.usc.edu",
    program: "MS Computer Science",
    year: 2020,
    company: "Forma",
    title: "Engineering Manager",
    location: "Los Angeles, CA",
    bio: "Helping engineers build useful things. Open to questions about software engineering, early-career interviews, and the Forma team.",
    skills: ["Software engineering", "React", "Python", "Mentorship"],
    color: "lavender",
  },
  {
    ...base,
    id: "sam",
    name: "Sam Okafor",
    role: "alumni",
    email: "sam.okafor@example.com",
    program: "BA Communication",
    year: 2022,
    company: "Kindred",
    title: "Growth Lead",
    location: "Remote",
    bio: "Growing a community-first company. I can share what I’ve learned about growth, marketing analytics, and finding your first team.",
    skills: ["Marketing", "Analytics", "Growth", "Community"],
    coffeeChats: false,
    color: "peach",
  },
];
export const initialResume = `Alex Kim
alex.kim@usc.edu · (213) 555-0142 · Los Angeles, CA · linkedin.com/in/alex-kim-demo · github.com/alexkim-demo

SUMMARY
CS junior at USC Viterbi who likes building reliable backend systems. Interned on a logistics data platform, built a Raft key-value store in Go, and works as a student developer for Viterbi IT.

EDUCATION
University of Southern California, Viterbi School of Engineering · B.S. · Computer Science · Aug 2023 · May 2027 · 3.72
Coursework: Operating Systems, Distributed Systems, Database Systems, Algorithms, Computer Networks
Honors: Dean's List (4 semesters), Viterbi Merit Scholarship

EXPERIENCE
Ridgeline Logistics · Software Engineering Intern · San Diego, CA · May 2025 · Aug 2025
Built a Go service that streams shipment status events from Kafka into PostgreSQL, handling about 3M events per day
Reduced p95 latency of the tracking API from 480 ms to 190 ms by adding Redis caching and removing N+1 queries
Added OpenTelemetry tracing across 4 services, helping the on-call team find the failing hop in minutes
Wrote integration tests with Testcontainers, raising routing module coverage from 41% to 78%
USC Viterbi IT · Student Developer · Los Angeles, CA · Sep 2024 · Present
Built a Python (FastAPI) service that syncs lab reservations for 1,200+ students across 14 labs
Cut the nightly sync job from 40 to 12 minutes by batching database writes and parallelizing API calls
Containerized 3 legacy cron jobs with Docker and moved them to a monitored scheduler
USC Department of Computer Science · Course Producer, CSCI 104 Data Structures · Los Angeles, CA · Jan 2025 · May 2025
Ran weekly labs for 30 students on C++ linked lists, heaps, and hash tables
Held 4 hours of office hours per week and graded 120+ homework submissions with written feedback
Trojan Robotics Club · Software Lead · Los Angeles, CA · Jan 2024 · Aug 2024
Led 5 students building ROS 2 navigation for a campus delivery robot, completing 40+ autonomous test runs
Set up GitHub Actions CI and a code review process, ending a pattern of broken builds on main

PROJECTS
Distributed Key-Value Store · Go, gRPC, Docker · github.com/alexkim-demo/kv · Jan 2025 · Apr 2025
Implemented Raft leader election, log replication, and snapshotting across a 5-node cluster
Built a fault-injection harness for network partitions and node crashes that found 3 leader-election bugs
Sustained 12k writes per second with linearizable reads on a local 5-node cluster
TrojanEats · React, TypeScript, Node.js, PostgreSQL · github.com/alexkim-demo/trojaneats · Sep 2024 · Dec 2024
Web app showing which campus dining halls are open and what they serve; 600+ weekly users in fall 2024
Designed the PostgreSQL schema and a scheduled scraper that ingests menus from 9 dining halls
Bus Arrival Predictor · Python, pandas, scikit-learn · github.com/alexkim-demo/metro-eta · Mar 2024 · May 2024
Trained a gradient-boosted model on 2M public LA Metro GPS records to predict bus arrival delays
Lowered mean absolute error from 4.1 to 2.3 minutes compared with the schedule-only baseline

SKILLS
Go, Python, Java, C++, TypeScript, SQL, FastAPI, React, gRPC, Kafka, Redis, PostgreSQL, Docker, Git, Linux, AWS (EC2/S3/RDS), GitHub Actions, OpenTelemetry`;
export function makeSeed(): BoardState {
  return {
    people: structuredClone(seedPeople),
    jobs: [
      {
        id: "j1",
        title: "Data Analyst Intern",
        company: "Arcwell",
        team: "Product Analytics",
        industry: "Technology",
        location: "Los Angeles, CA",
        workMode: "Hybrid",
        type: "Internship",
        description:
          "Help our product team understand how people use Arcwell. You’ll turn questions into analyses, build useful dashboards, and share insights that shape what we build next.",
        requirements:
          "Experience querying data with SQL\nFamiliarity with Python or R\nExperience building dashboards with Tableau\nClear written communication\nInterest in product analytics",
        instructions:
          "Send a short introduction and your resume. I’m happy to review relevant experience and discuss a referral. Please also follow the company application instructions.",
        applicationUrl: "",
        deadline: later(14),
        referralAvailable: true,
        alumniId: "maya",
        status: "open",
        createdAt: ago(1),
        color: "blue",
      },
      {
        id: "j2",
        title: "Associate Product Manager",
        company: "Northstar",
        team: "Core Experience",
        industry: "Technology",
        location: "San Francisco, CA",
        workMode: "Hybrid",
        type: "Full-time",
        description:
          "Partner with design and engineering to build a more intuitive everyday product. We’re looking for curiosity, good questions, and a thoughtful approach to solving user problems.",
        requirements:
          "Interest in product management\nExperience with analytics or user research\nAbility to communicate product ideas clearly\nComfort collaborating across teams",
        instructions:
          "Tell me about a product problem you enjoyed working on. I can answer questions about the team and consider referral requests.",
        applicationUrl: "",
        deadline: later(21),
        referralAvailable: true,
        alumniId: "jordan",
        status: "open",
        createdAt: ago(2),
        color: "green",
      },
      {
        id: "j3",
        title: "Software Engineer, New Grad",
        company: "Forma",
        team: "Developer Experience",
        industry: "Technology",
        location: "Los Angeles, CA",
        workMode: "On-site",
        type: "Full-time",
        description:
          "Build tools that help creative teams do their best work. Join a small engineering team where you can own real features and learn from experienced engineers.",
        requirements:
          "Programming experience with Python or JavaScript\nUnderstanding of data structures\nExperience with React\nInterest in collaborative software development",
        instructions:
          "Share a project you’re proud of and your resume. Relevant class projects count.",
        applicationUrl: "",
        deadline: later(18),
        referralAvailable: true,
        alumniId: "priya",
        status: "open",
        createdAt: ago(2),
        color: "purple",
      },
      {
        id: "j4",
        title: "Growth & Marketing Intern",
        company: "Kindred",
        team: "Community Growth",
        industry: "Consumer",
        location: "Remote",
        workMode: "Remote",
        type: "Internship",
        description:
          "Explore what brings people together. Help us understand our community, test thoughtful campaigns, and use data to learn what works.",
        requirements:
          "Interest in marketing and community\nComfort with spreadsheets and analytics\nStrong written communication\nCuriosity about experimentation",
        instructions:
          "I’m available to answer questions about the role. Applications go through the company process; I’m not offering referrals for this opening.",
        applicationUrl: "",
        deadline: later(10),
        referralAvailable: false,
        alumniId: "sam",
        status: "open",
        createdAt: ago(3),
        color: "orange",
      },
      {
        id: "j5",
        title: "Product Data Scientist",
        company: "Arcwell",
        team: "Insights & Experimentation",
        industry: "Technology",
        location: "Los Angeles, CA",
        workMode: "Hybrid",
        type: "Full-time",
        description:
          "Use experimentation and thoughtful measurement to help our team make better product decisions. Work closely with engineers, designers, and product managers.",
        requirements:
          "SQL and Python experience\nKnowledge of statistics\nExperience with A/B testing\nAbility to communicate analytical findings",
        instructions:
          "A brief note on a project involving statistics or experimentation is helpful.",
        applicationUrl: "",
        deadline: later(25),
        referralAvailable: true,
        alumniId: "maya",
        status: "open",
        createdAt: ago(4),
        color: "blue",
      },
      {
        id: "j6",
        title: "UX Research Intern",
        company: "Northstar",
        team: "Research & Design",
        industry: "Technology",
        location: "San Francisco, CA",
        workMode: "Remote",
        type: "Internship",
        description:
          "Listen to users, find patterns, and help the team understand what matters. You’ll support interviews, synthesize findings, and share opportunities with design.",
        requirements:
          "Experience with user research\nInterest in qualitative analysis\nStrong communication\nExperience presenting findings",
        instructions:
          "Ask me about the team or send your resume and a short introduction.",
        applicationUrl: "",
        deadline: later(12),
        referralAvailable: true,
        alumniId: "jordan",
        status: "open",
        createdAt: ago(5),
        color: "green",
      },
    ],
    resumes: [
      {
        id: "r1",
        ownerId: "alex",
        label: "My base resume",
        text: initialResume,
        sourceText: initialResume,
        createdAt: ago(5),
      },
    ],
    requests: [
      {
        id: "req-seed",
        kind: "job",
        studentId: "alex",
        alumniId: "maya",
        jobId: "j5",
        purpose: "referral",
        note: "Hi Maya! I’m a USC CS junior interested in your Product Data Scientist opening. I built a bus arrival prediction model in Python and work with SQL and Kafka data pipelines in my internship. I’d love to learn whether that background could be relevant for your team.",
        status: "pending",
        resumeSnapshot: initialResume,
        resumeLabel: "My base resume",
        profileSnapshot: structuredClone(seedPeople[0]),
        createdAt: ago(1),
      },
    ],
    messages: [],
  };
}
