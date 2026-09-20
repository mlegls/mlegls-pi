#!/usr/bin/env bun

// Shared `/iterate` helper: `footer` adds instructions and a routing marker;
// `prompt` combines PR context, current feedback, and durable memory.
//
// Installation options:
// 1. Place in `.github/scripts/agent-iteration.ts` (recommended)
// 2. Place in `ci-scripts/agent-iteration.ts`
// 3. Place in `scripts/agent-iteration.ts`
//
// Usage:
//   bun .github/scripts/agent-iteration.ts --command footer --workflow <workflow-id> --memory <memory-path>
//   bun .github/scripts/agent-iteration.ts --command prompt --workflow <workflow-id> --memory <memory-path> --repo <owner/repo> --pr-number <number> --comment-body <body>

interface Args {
	command: 'footer' | 'prompt'
	workflow: string
	memory: string
	repo?: string
	prNumber?: string
	commentBody?: string
}

const args = parseArgs(Bun.argv.slice(2))

if (args.command === 'footer') {
	process.stdout.write(renderFooter(args.workflow, args.memory))
} else {
	if (!args.repo || !args.prNumber) throw new Error('--repo and --pr-number are required for prompt')
	process.stdout.write(await renderIterationPrompt(args))
}

function renderFooter(workflow: string, memory: string): string {
	return `
---

### Iterating on this agent run

Comment \`/iterate <feedback>\` to update this PR through its originating workflow. Durable feedback enters future runs through agent memory.

<!-- codelayer-agent:workflow=${workflow};memory=${memory};version=1 -->
`.trim()
}

async function renderIterationPrompt(args: Args): Promise<string> {
	const memory = await readTextIfExists(args.memory)
	const pr = await ghJson(`repos/${args.repo}/pulls/${args.prNumber}`)
	const [issueComments, reviewComments] = await Promise.all([
		ghJson(`repos/${args.repo}/issues/${args.prNumber}/comments --paginate`),
		ghJson(`repos/${args.repo}/pulls/${args.prNumber}/comments --paginate`),
	])

	return `# Iteration Request

${stripIterateCommand(args.commentBody ?? '')}

# Workflow Identity

- Workflow: ${args.workflow}
- Agent memory file: ${args.memory}

# Instructions

Apply the Iteration Request to this PR branch. Put only concise guidance that should change future runs in ${args.memory}; exclude PR-specific details and transcripts. Commit and push changes. Report what changed and whether memory changed.

# Current Agent Memory

${memory || '(memory file is empty or missing)'}

# Pull Request

- Number: #${pr.number}
- Title: ${pr.title}
- State: ${pr.state}
- Base: ${pr.base?.ref ?? '(unknown)'}
- Head: ${pr.head?.ref ?? '(unknown)'}

## PR Body

${pr.body ?? '(empty)'}

# PR Issue Comments

${formatIssueComments(issueComments)}

# PR Review Comments

${formatReviewComments(reviewComments)}
`
}

async function readTextIfExists(path: string): Promise<string> {
	try {
		const file = Bun.file(path)
		if (!(await file.exists())) return ''
		return await file.text()
	} catch {
		return ''
	}
}

async function ghJson(pathAndArgs: string): Promise<any> {
	const result = await Bun.$`bash -lc ${`gh api ${pathAndArgs}`}`.text()
	return JSON.parse(result)
}

function formatIssueComments(comments: any): string {
	if (!Array.isArray(comments) || comments.length === 0) return '(no issue comments)'
	return comments
		.map((comment) => {
			return `Comment ${comment.id} by ${comment.user?.login ?? 'unknown'} at ${comment.created_at ?? 'unknown time'}:\n\n${comment.body ?? ''}`
		})
		.join('\n\n---\n\n')
}

function formatReviewComments(comments: any): string {
	if (!Array.isArray(comments) || comments.length === 0) return '(no review comments)'
	return comments
		.map((comment) => {
			return `Review comment ${comment.id} by ${comment.user?.login ?? 'unknown'} on ${comment.path ?? 'unknown path'}:${comment.line ?? comment.original_line ?? 'unknown line'} at ${comment.created_at ?? 'unknown time'}:\n\n${comment.body ?? ''}`
		})
		.join('\n\n---\n\n')
}

function stripIterateCommand(body: string): string {
	return body.trim().replace(/^\/iterate\b\s*/i, '').trim() || 'Iterate on this PR using the available feedback.'
}

function parseArgs(argv: string[]): Args {
	const parsed: Record<string, string> = {}
	for (let i = 0; i < argv.length; i += 1) {
		const arg = argv[i]
		if (!arg?.startsWith('--')) continue
		const key = arg.slice(2)
		const value = argv[i + 1]
		if (!value || value.startsWith('--')) throw new Error(`Missing value for ${arg}`)
		parsed[key] = value
		i += 1
	}

	const command = parsed.command
	if (command !== 'footer' && command !== 'prompt') throw new Error('--command must be footer or prompt')
	if (!parsed.workflow) throw new Error('--workflow is required')
	if (!parsed.memory) throw new Error('--memory is required')

	return {
		command,
		workflow: parsed.workflow,
		memory: parsed.memory,
		repo: parsed.repo,
		prNumber: parsed['pr-number'],
		commentBody: parsed['comment-body'],
	}
}
