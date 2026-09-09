// ----------------------------------------------------------------------------
// Copyright (c) Ben Coleman, 2020
// Licensed under the MIT License.
//
// Workflow Dispatch Action - Main task code
// ----------------------------------------------------------------------------

import * as core from '@actions/core'
import { collectJobFailures, describeFailures, reportFailures } from './failure-reason'
import { formatDuration, getArgs, getOctokit, isTimedOut, sleep } from './utils'
import { WorkflowHandler, WorkflowRunConclusion, WorkflowRunResult, WorkflowRunStatus } from './workflow-handler'
import { handleWorkflowLogsPerJob } from './workflow-logs-handler'



async function getFollowUrl(workflowHandler: WorkflowHandler, interval: number, timeout: number) {
  const start = Date.now()
  let url
  do {
    await sleep(interval)
    try {
      const result = await workflowHandler.getWorkflowRunStatus()
      url = result.url
    } catch(e: any) {
      core.debug(`Failed to get workflow url: ${e.message}`)
    }
  } while (!url && !isTimedOut(start, timeout))
  return url
}

async function waitForCompletionOrTimeout(workflowHandler: WorkflowHandler, checkStatusInterval: number, waitForCompletionTimeout: number) {
  const start = Date.now()
  let status
  let result
  do {
    await sleep(checkStatusInterval)
    try {
      result = await workflowHandler.getWorkflowRunStatus()
      status = result.status
      core.debug(`Worflow is running for ${formatDuration(Date.now() - start)}. Current status=${status}`)
    } catch(e: any) {
      core.warning(`Failed to get workflow status: ${e.message}`)
    }
  } while (status !== WorkflowRunStatus.COMPLETED && !isTimedOut(start, waitForCompletionTimeout))
  return { result, start }
}

function withReason(message: string, reason: string) {
  return reason ? `${message} - ${reason}` : message
}

function computeConclusion(start: number, waitForCompletionTimeout: number, reason: string, result?: WorkflowRunResult) {
  if (isTimedOut(start, waitForCompletionTimeout)) {
    core.info('Workflow wait timed out')
    core.setOutput('workflow-conclusion', WorkflowRunConclusion.TIMED_OUT)
    throw new Error('Workflow run has failed due to timeout')
  }

  core.info(`Workflow completed with conclusion=${result?.conclusion}`)
  const conclusion = result?.conclusion
  core.setOutput('workflow-conclusion', conclusion)

  if (conclusion === WorkflowRunConclusion.FAILURE)   throw new Error(withReason('Workflow run has failed', reason))
  if (conclusion === WorkflowRunConclusion.CANCELLED) throw new Error(withReason('Workflow run was cancelled', reason))
  if (conclusion === WorkflowRunConclusion.TIMED_OUT) throw new Error(withReason('Workflow run has failed due to timeout', reason))
}

// The message this step fails with is all a reader sees on the PR checks page, so carry the
// downstream job's own error into it rather than making them open the triggered run.
async function resolveFailureReason(args: any, workflowHandler: WorkflowHandler, result?: WorkflowRunResult): Promise<string> {
  const conclusion = result?.conclusion
  if (!conclusion || conclusion === WorkflowRunConclusion.SUCCESS) {
    return ''
  }
  try {
    const runId = await workflowHandler.getWorkflowRunId()
    const failures = await collectJobFailures(getOctokit(args.token), args.owner, args.repo, runId)
    if (failures.length === 0) {
      return ''
    }
    reportFailures(failures, result?.url)
    const reason = describeFailures(failures)
    core.setOutput('workflow-failure-reason', reason)
    return reason
  } catch (error: any) {
    core.warning(`Failed to read why the triggered workflow failed. Cause: ${error.message}`)
    return ''
  }
}

async function handleLogs(args: any, workflowHandler: WorkflowHandler) {
  try {
    const workflowRunId = await workflowHandler.getWorkflowRunId()
    await handleWorkflowLogsPerJob(args, workflowRunId)
  } catch(e: any) {
    core.error(`Failed to handle logs of triggered workflow. Cause: ${e}`)
  }
}

//
// Main task function (async wrapper)
//
async function run(): Promise<void> {
  try {
    const args = getArgs()
    const workflowHandler = new WorkflowHandler(args.token, args.workflowRef, args.owner, args.repo, args.ref, args.runName)

    // Trigger workflow run
    await workflowHandler.triggerWorkflow(args.inputs)
    core.info('Workflow triggered 🚀')

    if (args.displayWorkflowUrl) {
      const url = await getFollowUrl(workflowHandler, args.displayWorkflowUrlInterval, args.displayWorkflowUrlTimeout)
      core.info(`You can follow the running workflow here: ${url}`)
      core.setOutput('workflow-url', url)
    }

    if (!args.waitForCompletion) {
      return
    }

    core.info('Waiting for workflow completion')
    const { result, start } = await waitForCompletionOrTimeout(workflowHandler, args.checkStatusInterval, args.waitForCompletionTimeout)

    await handleLogs(args, workflowHandler)

    core.setOutput('workflow-id', result?.id)
    core.setOutput('workflow-url', result?.url)

    const reason = await resolveFailureReason(args, workflowHandler, result)
    computeConclusion(start, args.waitForCompletionTimeout, reason, result)

  } catch (error: any) {
    core.setFailed(error.message)
  }
}

//
// Call the main task run function
//
run()
