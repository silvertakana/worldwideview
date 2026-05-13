export type SiteEntityType = 'hq' | 'office' | 'datacenter' | 'ai';

export interface SiteTagEntry {
  siteId: string;
  name: string;
  entityType: SiteEntityType;
  city: string;
  tags: string[]; // Tag.id values from taxonomy
}

// Tech stacks sourced from GitHub repos, engineering blogs, and job postings (May 2026).
// Data center entries reflect common colocation operator stacks (VMware, Linux, Cisco).
export const SITE_TAGS: SiteTagEntry[] = [
  // ─────────────────────────────────────────────────────────────────────────
  // Tech HQs & Offices
  // ─────────────────────────────────────────────────────────────────────────
  {
    siteId: 'spacex-starbase',
    name: 'SpaceX',
    entityType: 'hq',
    city: 'Starbase, TX',
    tags: ['cpp', 'python', 'rust', 'linux', 'openssl', 'openssh'],
  },
  {
    siteId: 'tesla-austin',
    name: 'Tesla',
    entityType: 'hq',
    city: 'Austin, TX',
    tags: ['python', 'cpp', 'rust', 'linux', 'cuda', 'pytorch', 'tensorflow', 'aws', 'gcp', 'postgresql', 'kubernetes', 'docker', 'nvidia', 'openssl', 'openssh'],
  },
  {
    siteId: 'crowdstrike-austin',
    name: 'CrowdStrike',
    entityType: 'hq',
    city: 'Austin, TX',
    tags: ['golang', 'python', 'rust', 'kafka', 'kubernetes', 'aws', 'elasticsearch', 'linux', 'windows', 'docker', 'openssl', 'openssh'],
  },
  {
    siteId: 'cirrus-logic-austin',
    name: 'Cirrus Logic',
    entityType: 'hq',
    city: 'Austin, TX',
    tags: ['cpp', 'linux', 'arm', 'openssh'],
  },
  {
    siteId: 'silicon-labs-austin',
    name: 'Silicon Labs',
    entityType: 'hq',
    city: 'Austin, TX',
    tags: ['cpp', 'linux', 'arm', 'openssl'],
  },
  {
    siteId: 'yeti-austin',
    name: 'YETI Holdings',
    entityType: 'hq',
    city: 'Austin, TX',
    tags: ['nodejs', 'react', 'aws', 'nextjs'],
  },
  {
    siteId: 'bumble-austin',
    name: 'Bumble',
    entityType: 'hq',
    city: 'Austin, TX',
    tags: ['python', 'swift', 'kotlin', 'aws', 'postgresql', 'redis', 'kubernetes', 'docker', 'kafka'],
  },
  {
    siteId: 'q2-holdings-austin',
    name: 'Q2 Holdings',
    entityType: 'hq',
    city: 'Austin, TX',
    tags: ['java', 'dotnet', 'aws', 'oracle_db', 'react', 'postgresql', 'kubernetes', 'spring', 'mssql'],
  },
  {
    siteId: 'commerce-austin',
    name: 'Commerce.com (fmr. BigCommerce)',
    entityType: 'hq',
    city: 'Austin, TX',
    tags: ['php', 'nodejs', 'python', 'aws', 'mysql', 'redis', 'elasticsearch', 'react', 'kubernetes', 'docker', 'nginx'],
  },
  {
    siteId: 'wpengine-austin',
    name: 'WP Engine',
    entityType: 'hq',
    city: 'Austin, TX',
    tags: ['php', 'wordpress', 'nodejs', 'aws', 'mysql', 'nginx', 'redis', 'kubernetes', 'docker', 'openssl'],
  },
  {
    siteId: 'solarwinds-austin',
    name: 'SolarWinds',
    entityType: 'hq',
    city: 'Austin, TX',
    tags: ['dotnet', 'csharp', 'mssql', 'windows', 'openssl', 'linux'],
  },
  {
    siteId: 'cloudflare-austin',
    name: 'Cloudflare Austin Office',
    entityType: 'office',
    city: 'Austin, TX',
    tags: ['golang', 'rust', 'nginx', 'lua', 'linux', 'cloudflare', 'tls', 'openssl', 'docker', 'kubernetes'],
  },
  {
    siteId: 'oracle-austin',
    name: 'Oracle',
    entityType: 'hq',
    city: 'Austin, TX',
    tags: ['java', 'cpp', 'oracle_db', 'python', 'linux', 'kubernetes', 'aws', 'azure', 'gcp', 'openssl', 'openssh', 'dotnet', 'spring'],
  },
  {
    siteId: 'apple-austin',
    name: 'Apple Austin Campus',
    entityType: 'hq',
    city: 'Austin, TX',
    tags: ['swift', 'cpp', 'python', 'linux', 'arm', 'macos', 'openssl', 'openssh', 'intel'],
  },
  {
    siteId: 'dell-roundrock',
    name: 'Dell Technologies',
    entityType: 'hq',
    city: 'Round Rock, TX',
    tags: ['java', 'cpp', 'python', 'windows', 'linux', 'vmware', 'kubernetes', 'mysql', 'mssql', 'openssl', 'openssh'],
  },
  {
    siteId: 'ti-dallas',
    name: 'Texas Instruments',
    entityType: 'hq',
    city: 'Dallas, TX',
    tags: ['cpp', 'linux', 'arm', 'python', 'openssh'],
  },
  {
    siteId: 'att-dallas',
    name: 'AT&T',
    entityType: 'hq',
    city: 'Dallas, TX',
    tags: ['java', 'linux', 'kubernetes', 'aws', 'azure', 'oracle_db', 'mysql', 'cisco', 'openssl', 'openssh', 'tls'],
  },
  {
    siteId: 'matchgroup-dallas',
    name: 'Match Group',
    entityType: 'hq',
    city: 'Dallas, TX',
    tags: ['python', 'golang', 'java', 'aws', 'kafka', 'elasticsearch', 'mongodb', 'redis', 'kubernetes', 'docker', 'spring'],
  },
  {
    siteId: 'tyler-plano',
    name: 'Tyler Technologies',
    entityType: 'hq',
    city: 'Plano, TX',
    tags: ['dotnet', 'csharp', 'azure', 'mssql', 'react', 'java', 'spring', 'openssl'],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Data Centers
  // ─────────────────────────────────────────────────────────────────────────
  {
    siteId: 'switch-tx1-austin',
    name: 'Switch Texas 1',
    entityType: 'datacenter',
    city: 'Austin, TX',
    tags: ['vmware', 'linux', 'cisco', 'openssl', 'openssh'],
  },
  {
    siteId: 'switch-tx2-austin',
    name: 'Switch Texas 2',
    entityType: 'datacenter',
    city: 'Austin, TX',
    tags: ['vmware', 'linux', 'cisco', 'openssl', 'openssh'],
  },
  {
    siteId: 'cyrusone-aus2',
    name: 'CyrusOne AUS2',
    entityType: 'datacenter',
    city: 'Austin, TX',
    tags: ['vmware', 'linux', 'cisco', 'openssl'],
  },
  {
    siteId: 'cyrusone-aus3',
    name: 'CyrusOne AUS3',
    entityType: 'datacenter',
    city: 'Austin, TX',
    tags: ['vmware', 'linux', 'cisco', 'openssl'],
  },
  {
    siteId: 'sabey-roundrock',
    name: 'Sabey SDC Austin',
    entityType: 'datacenter',
    city: 'Round Rock, TX',
    tags: ['vmware', 'linux', 'openssl', 'openssh'],
  },
  {
    siteId: 'switch-roundrock',
    name: 'Switch Round Rock',
    entityType: 'datacenter',
    city: 'Round Rock, TX',
    tags: ['vmware', 'linux', 'cisco', 'openssl', 'openssh'],
  },
  {
    siteId: 'skybox-roundrock',
    name: 'Skybox Round Rock',
    entityType: 'datacenter',
    city: 'Round Rock, TX',
    tags: ['linux', 'vmware'],
  },
  {
    siteId: 'colovore-hutto',
    name: 'Colovore Hutto',
    entityType: 'datacenter',
    city: 'Hutto, TX',
    tags: ['linux'],
  },
  {
    siteId: 'infomart-dallas',
    name: 'Infomart Dallas (Equinix)',
    entityType: 'datacenter',
    city: 'Dallas, TX',
    tags: ['linux', 'vmware', 'cisco', 'bgp', 'openssl', 'tls'],
  },
  {
    siteId: 'google-midlothian',
    name: 'Google Midlothian Campus',
    entityType: 'datacenter',
    city: 'Midlothian, TX',
    tags: ['linux', 'kubernetes', 'golang', 'python', 'tensorflow', 'gcp', 'nvidia', 'cuda', 'openssl', 'openssh'],
  },
  {
    siteId: 'digital-realty-lewisville',
    name: 'Digital Realty DFW Campus',
    entityType: 'datacenter',
    city: 'Lewisville, TX',
    tags: ['vmware', 'linux', 'cisco', 'openssl', 'openssh'],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // AI Centers & Research
  // ─────────────────────────────────────────────────────────────────────────
  {
    siteId: 'xai-seaholm-austin',
    name: 'xAI Austin Office',
    entityType: 'ai',
    city: 'Austin, TX',
    tags: ['python', 'cuda', 'pytorch', 'linux', 'kubernetes', 'nvidia', 'docker', 'openssl', 'openssh'],
  },
  {
    siteId: 'terafab-austin',
    name: 'Terafab (AI Chip Fab)',
    entityType: 'ai',
    city: 'Austin, TX',
    tags: ['cpp', 'linux', 'intel', 'nvidia'],
  },
  {
    siteId: 'tacc-frontera-austin',
    name: 'TACC / Frontera Supercomputer',
    entityType: 'ai',
    city: 'Austin, TX',
    tags: ['linux', 'python', 'cuda', 'intel', 'openssh', 'openssl', 'cpp'],
  },
  {
    siteId: 'tacc-horizon-roundrock',
    name: 'TACC Horizon AI Supercomputer',
    entityType: 'ai',
    city: 'Round Rock, TX',
    tags: ['linux', 'cuda', 'python', 'nvidia', 'kubernetes', 'openssh', 'openssl'],
  },
  {
    siteId: 'ifml-ut-austin',
    name: 'IFML / UT Austin AI Lab',
    entityType: 'ai',
    city: 'Austin, TX',
    tags: ['python', 'pytorch', 'tensorflow', 'linux', 'cuda', 'openssl'],
  },
];
