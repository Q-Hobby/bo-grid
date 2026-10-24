// A small team list for the docs' rich-cell examples.
export type Member = {
  id: number;
  name: string;
  role: string;
  email: string;
  status: 'Active' | 'Away' | 'Offline';
  workload: number;
  rating: number;
  skills: string[];
};

/** A fresh copy of the team, so one example's edits never reach another. */
export function team(): Member[] {
  return [
    { id: 1, name: 'Ava Chen', role: 'Engineer', email: 'ava@acme.io', status: 'Active', workload: 82, rating: 5, skills: ['TypeScript', 'Svelte'] },
    { id: 2, name: 'Liam Patel', role: 'Designer', email: 'liam@acme.io', status: 'Away', workload: 46, rating: 4, skills: ['Figma', 'CSS'] },
    { id: 3, name: 'Mia Kim', role: 'PM', email: 'mia@acme.io', status: 'Active', workload: 64, rating: 4, skills: ['Roadmaps'] },
    { id: 4, name: 'Noah Garcia', role: 'Analyst', email: 'noah@acme.io', status: 'Offline', workload: 21, rating: 3, skills: ['SQL', 'Python'] },
    { id: 5, name: 'Zoe Nguyen', role: 'Engineer', email: 'zoe@acme.io', status: 'Active', workload: 93, rating: 5, skills: ['Rust', 'Go'] },
    { id: 6, name: 'Ravi Haddad', role: 'Researcher', email: 'ravi@acme.io', status: 'Away', workload: 38, rating: 2, skills: ['Data viz'] },
    { id: 7, name: 'Yuki Rossi', role: 'Writer', email: 'yuki@acme.io', status: 'Active', workload: 57, rating: 4, skills: ['Docs', 'CSS'] },
  ];
}
