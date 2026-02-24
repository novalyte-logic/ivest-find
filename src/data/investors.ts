export interface Investor {
  id: string;
  name: string;
  role: string;
  firm?: string;
  bio: string;
  focus: string[];
  location: string;
  investmentRange: string;
  notableInvestments: string[];
  imageUrl: string;
  // New fields
  investmentThesis: string;
  industryExpertise: string[];
  contactPreference: string;
  tags: string[];
  stage: 'Pre-Seed' | 'Seed' | 'Series A' | 'Late Stage';
  linkedinUrl?: string;
}

export const initialInvestors: Investor[] = [
  {
    id: '1',
    name: 'Sarah Chen',
    role: 'Angel Investor',
    firm: 'HealthAI Ventures',
    bio: 'Former CMO of a major health tech unicorn. Passionate about early-stage AI applications in diagnostics and patient care.',
    focus: ['Health Tech', 'AI Diagnostics', 'Digital Health'],
    location: 'San Francisco, CA',
    investmentRange: '$50k - $200k',
    notableInvestments: ['CureFlow', 'MedMind', 'ScanAI'],
    imageUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=200&h=200',
    investmentThesis: 'Backing founders who bridge the gap between clinical excellence and cutting-edge AI.',
    industryExpertise: ['Clinical Diagnostics', 'Hospital Operations', 'Go-to-Market'],
    contactPreference: 'Email',
    tags: [],
    stage: 'Pre-Seed',
    linkedinUrl: 'https://linkedin.com/in/sarahchen-example'
  },
  {
    id: '2',
    name: 'David Miller',
    role: 'Managing Partner',
    firm: 'BioTech Angels',
    bio: '20 years in biotech and software. Specifically interested in the intersection of biology and machine learning.',
    focus: ['Bioinformatics', 'AI/ML', 'SaaS'],
    location: 'Boston, MA',
    investmentRange: '$100k - $500k',
    notableInvestments: ['GeneSys', 'BioGraph', 'CellularAI'],
    imageUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=200&h=200',
    investmentThesis: 'Scalable software solutions for complex biological problems.',
    industryExpertise: ['Bioinformatics', 'SaaS Scaling', 'Enterprise Sales'],
    contactPreference: 'LinkedIn',
    tags: [],
    stage: 'Seed',
    linkedinUrl: 'https://linkedin.com/in/davidmiller-example'
  },
  {
    id: '3',
    name: 'Elena Rodriguez',
    role: 'Independent Angel',
    bio: 'Focused on democratizing healthcare access through technology. Loves pre-seed startups solving real-world problems.',
    focus: ['Telehealth', 'AI Assistants', 'Health Equity'],
    location: 'New York, NY',
    investmentRange: '$25k - $100k',
    notableInvestments: ['HealthBridge', 'CareConnect'],
    imageUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=200&h=200',
    investmentThesis: 'Technology that makes healthcare accessible to the 99%.',
    industryExpertise: ['Public Health', 'Consumer Apps', 'Product Design'],
    contactPreference: 'Twitter / X',
    tags: [],
    stage: 'Pre-Seed',
    linkedinUrl: 'https://linkedin.com/in/elenarodriguez-example'
  },
  {
    id: '4',
    name: 'Michael Chang',
    role: 'Tech Lead / Angel',
    bio: 'Senior AI Researcher turned investor. Deep technical understanding of LLMs and generative AI.',
    focus: ['Generative AI', 'Infrastructure', 'MedTech'],
    location: 'Seattle, WA',
    investmentRange: '$50k - $150k',
    notableInvestments: ['NeuralHealth', 'DeepScan'],
    imageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200&h=200',
    investmentThesis: 'Deep tech infrastructure that powers the next generation of medical applications.',
    industryExpertise: ['Large Language Models', 'Cloud Infrastructure', 'Technical Hiring'],
    contactPreference: 'Email',
    tags: [],
    stage: 'Pre-Seed',
    linkedinUrl: 'https://linkedin.com/in/michaelchang-example'
  },
  {
    id: '5',
    name: 'Dr. James Wilson',
    role: 'Physician / Angel',
    bio: 'Practicing cardiologist investing in tools that improve clinical workflow and patient outcomes.',
    focus: ['Clinical Workflow', 'Patient Monitoring', 'AI'],
    location: 'Chicago, IL',
    investmentRange: '$25k - $75k',
    notableInvestments: ['HeartBeat AI', 'ClinicFlow'],
    imageUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=200&h=200',
    investmentThesis: 'Practical tools that reduce physician burnout and improve patient safety.',
    industryExpertise: ['Cardiology', 'Clinical Trials', 'FDA Regulation'],
    contactPreference: 'Warm Intro',
    tags: [],
    stage: 'Pre-Seed',
    linkedinUrl: 'https://linkedin.com/in/jameswilson-example'
  }
];
