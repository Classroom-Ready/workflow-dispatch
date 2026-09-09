// Imports nothing from the rest of src/: the tests load this module under Node's
// --experimental-strip-types runner, which resolves neither extensionless relative imports
// nor the enums in workflow-handler.ts.
import * as core from '@actions/core'

export interface JobFailure {
  name: string,
  conclusion: string,
  reasons: Array<string>
}

// Conclusions that mean the job did not do its work. `skipped` is deliberately absent: a
// skipped job has no log to download, and asking for one 404s.
const FAILED_CONCLUSIONS = ['failure', 'timed_out', 'cancelled', 'action_required']

// Downloaded job logs are '<ISO-8601 timestamp> <line>'. The timestamp is optional here so a
// line that arrives without one keeps its first word. A `::error title=X::msg` workflow
// command reaches the log as '##[error]msg' - the title is not in the log, only the message.
const LOG_LINE = /^(?:\d{4}-\d{2}-\d{2}T\S+Z\s)?(.*)$/
const ERROR_LINE = /^##\[error\](.*)$/
// The runner emits this for any non-zero step; it names no cause, so it is only worth
// reporting when the job logged nothing more specific.
const EXIT_CODE_ONLY = /^Process completed with exit code \d+\.?$/

export function extractErrorMessages(logs: string): Array<string> {
  const messages: Array<string> = []
  for (const rawLine of logs.split('\n')) {
    const line = rawLine.replace(/\r$/, '').match(LOG_LINE)?.[1]
    const message = line?.match(ERROR_LINE)?.[1]?.trim()
    if (message && !messages.includes(message)) {
      messages.push(message)
    }
  }
  const specific = messages.filter(message => !EXIT_CODE_ONLY.test(message))
  return specific.length > 0 ? specific : messages
}

export function describeFailures(failures: Array<JobFailure>): string {
  return failures
    .map(failure => `${failure.name}: ${failure.reasons.join(' / ') || failure.conclusion}`)
    .join(' | ')
}

export async function collectJobFailures(octokit: any, owner: string, repo: string, runId: number): Promise<Array<JobFailure>> {
  const response = await octokit.rest.actions.listJobsForWorkflowRun({
    owner: owner,
    repo: repo,
    run_id: runId
  })

  const failures: Array<JobFailure> = []
  for (const job of response.data.jobs) {
    if (!FAILED_CONCLUSIONS.includes(job.conclusion)) {
      continue
    }
    let reasons: Array<string> = []
    try {
      const jobLog = await octokit.rest.actions.downloadJobLogsForWorkflowRun({
        owner: owner,
        repo: repo,
        job_id: job.id
      })
      reasons = extractErrorMessages(jobLog.data as string)
    } catch (error: any) {
      core.debug(`Failed to read logs of job '${job.name}' (${job.id}). Cause: ${error.message}`)
    }
    failures.push({ name: job.name, conclusion: job.conclusion, reasons })
  }
  return failures
}

// Repeats each downstream reason as an annotation and a summary row on the triggering run, so
// the cause is readable there without opening the dispatched run.
export function reportFailures(failures: Array<JobFailure>, runUrl?: string): void {
  for (const failure of failures) {
    for (const reason of failure.reasons) {
      core.error(reason, { title: `${failure.name} (${failure.conclusion})` })
    }
    if (failure.reasons.length === 0) {
      core.error(`Job '${failure.name}' ended as ${failure.conclusion} and logged no error.`, {
        title: `${failure.name} (${failure.conclusion})`
      })
    }
  }

  if (!process.env.GITHUB_STEP_SUMMARY) {
    return
  }
  try {
    let summary = core.summary.addHeading('Dispatched workflow failed', 3)
    if (runUrl) {
      summary = summary.addRaw(`Run: ${runUrl}`, true)
    }
    summary = summary.addTable([
      [{ data: 'Job', header: true }, { data: 'Conclusion', header: true }, { data: 'Reason', header: true }],
      ...failures.map(failure => [
        failure.name,
        failure.conclusion,
        failure.reasons.join('<br>') || '(no error logged)'
      ])
    ])
    summary.write()
  } catch (error: any) {
    core.debug(`Failed to write job summary. Cause: ${error.message}`)
  }
}
