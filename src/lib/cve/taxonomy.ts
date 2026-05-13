export type TagCategory =
  | 'language'
  | 'framework'
  | 'database'
  | 'cloud'
  | 'devops'
  | 'os'
  | 'hardware'
  | 'network';

export interface Tag {
  id: string;
  category: TagCategory;
  label: string;
  /** Lowercase substrings matched against CVE description text and CPE criteria strings. */
  matchPatterns: string[];
}

export const TAGS: Tag[] = [
  // ── Languages ──────────────────────────────────────────────────────────────
  {
    id: 'python',
    category: 'language',
    label: 'Python',
    matchPatterns: ['python'],
  },
  {
    id: 'golang',
    category: 'language',
    label: 'Go',
    matchPatterns: ['golang', 'go programming language', '/go:', 'google:go'],
  },
  {
    id: 'rust',
    category: 'language',
    label: 'Rust',
    matchPatterns: ['rust programming', 'rustlang', 'rust-lang', 'rust_lang'],
  },
  {
    id: 'java',
    category: 'language',
    label: 'Java',
    matchPatterns: ['java se', 'java_se', 'openjdk', 'oracle:jdk', 'jdk ', 'jre ', 'graalvm'],
  },
  {
    id: 'dotnet',
    category: 'language',
    label: '.NET',
    matchPatterns: ['.net', 'asp.net', 'dotnet', 'mono_project', 'microsoft:.net'],
  },
  {
    id: 'csharp',
    category: 'language',
    label: 'C#',
    matchPatterns: ['c# ', 'visual c#', 'microsoft:c#'],
  },
  {
    id: 'cpp',
    category: 'language',
    label: 'C/C++',
    matchPatterns: ['c++', 'c_plus_plus', 'boost library', 'llvm', 'clang'],
  },
  {
    id: 'php',
    category: 'language',
    label: 'PHP',
    matchPatterns: ['php', 'php-fpm', 'php_group'],
  },
  {
    id: 'nodejs',
    category: 'language',
    label: 'Node.js',
    matchPatterns: ['node.js', 'nodejs', 'npm ', 'node_js', 'nodejs:node.js'],
  },
  {
    id: 'lua',
    category: 'language',
    label: 'Lua',
    matchPatterns: ['lua ', 'lua5', '/lua:', 'luajit'],
  },
  {
    id: 'ruby',
    category: 'language',
    label: 'Ruby',
    matchPatterns: ['ruby', 'rubygems', 'ruby on rails', 'rubyonrails'],
  },
  {
    id: 'swift',
    category: 'language',
    label: 'Swift',
    matchPatterns: ['apple:swift', 'swift programming'],
  },
  {
    id: 'kotlin',
    category: 'language',
    label: 'Kotlin',
    matchPatterns: ['kotlin', 'jetbrains:kotlin'],
  },

  // ── Frameworks & Runtimes ──────────────────────────────────────────────────
  {
    id: 'react',
    category: 'framework',
    label: 'React',
    matchPatterns: ['react', 'facebook:react', 'meta:react'],
  },
  {
    id: 'wordpress',
    category: 'framework',
    label: 'WordPress',
    matchPatterns: ['wordpress', 'wp-', 'wordpress:wordpress'],
  },
  {
    id: 'django',
    category: 'framework',
    label: 'Django',
    matchPatterns: ['django', 'djangoproject', 'djangoproject:django'],
  },
  {
    id: 'flask',
    category: 'framework',
    label: 'Flask',
    matchPatterns: ['flask', 'pallets:flask', 'pallets-eco'],
  },
  {
    id: 'spring',
    category: 'framework',
    label: 'Spring Framework',
    matchPatterns: ['spring framework', 'spring boot', 'spring_framework', 'vmware:spring', 'pivotal:spring'],
  },
  {
    id: 'nextjs',
    category: 'framework',
    label: 'Next.js',
    matchPatterns: ['next.js', 'nextjs', 'vercel:next.js', 'vercel:next'],
  },
  {
    id: 'express',
    category: 'framework',
    label: 'Express',
    matchPatterns: ['express.js', 'expressjs', 'express_js'],
  },

  // ── Databases ─────────────────────────────────────────────────────────────
  {
    id: 'postgresql',
    category: 'database',
    label: 'PostgreSQL',
    matchPatterns: ['postgresql', 'postgres', 'postgresql:postgresql'],
  },
  {
    id: 'mysql',
    category: 'database',
    label: 'MySQL',
    matchPatterns: ['mysql', 'mariadb', 'oracle:mysql'],
  },
  {
    id: 'mssql',
    category: 'database',
    label: 'SQL Server',
    matchPatterns: ['sql server', 'mssql', 'microsoft:sql_server', 'microsoft sql'],
  },
  {
    id: 'mongodb',
    category: 'database',
    label: 'MongoDB',
    matchPatterns: ['mongodb', 'mongodb:mongodb'],
  },
  {
    id: 'redis',
    category: 'database',
    label: 'Redis',
    matchPatterns: ['redis', 'redis:redis'],
  },
  {
    id: 'elasticsearch',
    category: 'database',
    label: 'Elasticsearch',
    matchPatterns: ['elasticsearch', 'elastic:elasticsearch'],
  },
  {
    id: 'oracle_db',
    category: 'database',
    label: 'Oracle Database',
    matchPatterns: ['oracle database', 'oracle_database', 'oracle:database'],
  },
  {
    id: 'sqlite',
    category: 'database',
    label: 'SQLite',
    matchPatterns: ['sqlite', 'sqlite:sqlite'],
  },
  {
    id: 'kafka',
    category: 'database',
    label: 'Apache Kafka',
    matchPatterns: ['kafka', 'apache:kafka', 'apache kafka'],
  },

  // ── Cloud Platforms ────────────────────────────────────────────────────────
  {
    id: 'aws',
    category: 'cloud',
    label: 'AWS',
    matchPatterns: ['amazon web services', 'amazon_aws', 'amazon:aws', 'amazon:ec2', 'amazon:s3'],
  },
  {
    id: 'gcp',
    category: 'cloud',
    label: 'GCP',
    matchPatterns: ['google cloud', 'google:cloud', 'google_cloud', 'google kubernetes engine', 'bigquery'],
  },
  {
    id: 'azure',
    category: 'cloud',
    label: 'Azure',
    matchPatterns: ['azure', 'microsoft:azure', 'microsoft azure'],
  },
  {
    id: 'cloudflare',
    category: 'cloud',
    label: 'Cloudflare',
    matchPatterns: ['cloudflare', 'cloudflare:cloudflare', 'cloudflare workers'],
  },

  // ── DevOps & Infrastructure ────────────────────────────────────────────────
  {
    id: 'kubernetes',
    category: 'devops',
    label: 'Kubernetes',
    matchPatterns: ['kubernetes', 'k8s', 'kubernetes:kubernetes'],
  },
  {
    id: 'docker',
    category: 'devops',
    label: 'Docker',
    matchPatterns: ['docker', 'containerd', 'moby', 'docker:docker'],
  },
  {
    id: 'vmware',
    category: 'devops',
    label: 'VMware / vSphere',
    matchPatterns: ['vmware', 'vsphere', 'vcenter', 'esxi', 'vmware:vcenter', 'vmware:esxi'],
  },
  {
    id: 'nginx',
    category: 'devops',
    label: 'Nginx',
    matchPatterns: ['nginx', 'nginx:nginx', 'nginx inc'],
  },
  {
    id: 'apache_http',
    category: 'devops',
    label: 'Apache httpd',
    matchPatterns: ['apache http server', 'apache httpd', 'apache:http_server'],
  },
  {
    id: 'openssl',
    category: 'devops',
    label: 'OpenSSL',
    matchPatterns: ['openssl', 'openssl:openssl'],
  },
  {
    id: 'openssh',
    category: 'devops',
    label: 'OpenSSH',
    matchPatterns: ['openssh', 'openssh:openssh', 'openbsd:openssh'],
  },
  {
    id: 'curl',
    category: 'devops',
    label: 'curl / libcurl',
    matchPatterns: ['libcurl', 'curl:curl', 'haxx:curl', 'haxx:libcurl'],
  },

  // ── Operating Systems ──────────────────────────────────────────────────────
  {
    id: 'linux',
    category: 'os',
    label: 'Linux Kernel',
    matchPatterns: ['linux kernel', 'linux_kernel', 'the linux kernel', 'linux:linux_kernel'],
  },
  {
    id: 'windows',
    category: 'os',
    label: 'Windows',
    matchPatterns: ['microsoft windows', 'microsoft:windows', 'windows server', 'windows_server'],
  },
  {
    id: 'macos',
    category: 'os',
    label: 'macOS',
    matchPatterns: ['macos', 'mac os x', 'apple:macos', 'apple:mac_os_x'],
  },

  // ── AI / ML / GPU ─────────────────────────────────────────────────────────
  {
    id: 'pytorch',
    category: 'hardware',
    label: 'PyTorch',
    matchPatterns: ['pytorch', 'pytorch:pytorch', 'torch '],
  },
  {
    id: 'tensorflow',
    category: 'hardware',
    label: 'TensorFlow',
    matchPatterns: ['tensorflow', 'google:tensorflow'],
  },
  {
    id: 'cuda',
    category: 'hardware',
    label: 'CUDA',
    matchPatterns: ['cuda', 'nvidia:cuda', 'nvidia cuda'],
  },
  {
    id: 'nvidia',
    category: 'hardware',
    label: 'NVIDIA',
    matchPatterns: ['nvidia', 'nvidia:nvidia_driver', 'nvidia:gpu', 'nvidia:geforce'],
  },
  {
    id: 'intel',
    category: 'hardware',
    label: 'Intel',
    matchPatterns: ['intel:', 'intel corporation', 'intel xeon', 'intel core', 'transient execution'],
  },
  {
    id: 'amd',
    category: 'hardware',
    label: 'AMD',
    matchPatterns: ['amd:amd', 'advanced micro devices', 'amd processor', 'amd:ryzen', 'amd:epyc'],
  },
  {
    id: 'arm',
    category: 'hardware',
    label: 'ARM',
    matchPatterns: ['arm cortex', 'arm:arm', 'arm holdings', 'armv8', 'trustzone'],
  },

  // ── Network ────────────────────────────────────────────────────────────────
  {
    id: 'cisco',
    category: 'network',
    label: 'Cisco',
    matchPatterns: ['cisco', 'cisco:cisco', 'cisco ios', 'cisco nx-os', 'cisco asa'],
  },
  {
    id: 'bgp',
    category: 'network',
    label: 'BGP',
    matchPatterns: ['border gateway protocol', 'bgp ', 'bgp_', 'frrouting'],
  },
  {
    id: 'vpn',
    category: 'network',
    label: 'VPN',
    matchPatterns: ['openvpn', 'wireguard', 'ipsec', 'strongswan', 'openvpn:openvpn'],
  },
  {
    id: 'tls',
    category: 'network',
    label: 'TLS/SSL',
    matchPatterns: ['tls ', 'tls1.', 'wolfssl', 'mbedtls', 'boringssl', 'gnutls'],
  },
];

export const TAG_MAP = new Map<string, Tag>(TAGS.map((t) => [t.id, t]));
