// Imports nothing from the rest of src/: the tests load this module under Node's
// --experimental-strip-types runner, which resolves neither extensionless relative imports
// nor the enums in workflow-handler.ts.
import * as core from '@actions/core'

// A dispatched workflow with `concurrency: cancel-in-progress` cancels its running run when a
// newer run starts. The newer run tests a newer state of the same thing, so a caller waiting
// on the cancelled run follows the newer one and finishes with its result.

export interface SupersedingRun {
  id: number,
  url: string
}

// The newest run of the same workflow on the same branch that started after `runId`, from any
// trigger (a push to the branch supersedes a dispatched run too). GitHub reports created_at to
// the second, so a run created in the same second counts as later only when its id is higher.
export async function findSupersedingRun(octokit: any, owner: string, repo: string, runId: number): Promise<SupersedingRun | undefined> {
  const { data: cancelled } = await octokit.rest.actions.getWorkflowRun({
    owner: owner,
    repo: repo,
    run_id: runId
  })
  const cancelledAt = Date.parse(cancelled.created_at)

  const { data } = await octokit.rest.actions.listWorkflowRuns({
    owner: owner,
    repo: repo,
    workflow_id: cancelled.workflow_id,
    branch: cancelled.head_branch,
    created: `>=${cancelled.created_at}`
  })

  const later = data.workflow_runs.filter((run: any) => {
    const createdAt = Date.parse(run.created_at)
    return createdAt > cancelledAt || (createdAt === cancelledAt && run.id > runId)
  })
  if (later.length === 0) {
    return undefined
  }
  const newest = later.reduce((a: any, b: any) => {
    const byCreated = Date.parse(b.created_at) - Date.parse(a.created_at)
    return byCreated > 0 || (byCreated === 0 && b.id > a.id) ? b : a
  })
  return { id: newest.id, url: newest.html_url }
}

export interface FollowOptions<T> {
  // At most this many superseding runs are followed; 0 follows none.
  maxFollows: number,
  // The run's id when it ended cancelled, otherwise undefined.
  cancelledRunId: (waited: T) => number | undefined,
  findSuccessor: (runId: number) => Promise<SupersedingRun | undefined>,
  // Switches to the successor and waits for it.
  follow: (successor: SupersedingRun) => Promise<T>
}

export async function followSupersedingRuns<T>(waited: T, options: FollowOptions<T>): Promise<T> {
  for (let follows = 0; follows < options.maxFollows; follows++) {
    const runId = options.cancelledRunId(waited)
    if (runId === undefined) {
      return waited
    }

    let successor: SupersedingRun | undefined
    try {
      successor = await options.findSuccessor(runId)
    } catch (error: any) {
      core.warning(`Failed to look for a run that superseded cancelled run ${runId}. Cause: ${error.message}`)
      return waited
    }
    if (!successor) {
      return waited
    }

    core.info(`Run ${runId} was cancelled by newer run ${successor.id}; following it: ${successor.url}`)
    waited = await options.follow(successor)
  }
  return waited
}
