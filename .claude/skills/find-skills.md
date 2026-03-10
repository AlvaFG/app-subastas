# find-skills

Source: vercel-labs/skills
Hash: 25872a21881a950edc3db1f3329664d60405d539660ce05b3265db2de06a7dfd

## Description
Discover and install additional skills for your coding agent from the vercel-labs/skills registry.

## Usage
When the user asks to find or discover new skills, search the registry at https://github.com/vercel-labs/skills for available skills.

### Install a skill
```bash
npx skills add https://github.com/vercel-labs/skills --skill <skill-name>
```

### List available skills
```bash
npx skills list https://github.com/vercel-labs/skills
```

### Search for skills by keyword
```bash
npx skills search <keyword>
```

## Trigger
TRIGGER when: user asks to find, discover, search, or install new skills/plugins for their coding agent.
DO NOT TRIGGER when: user is asking about general project features or unrelated tooling.
