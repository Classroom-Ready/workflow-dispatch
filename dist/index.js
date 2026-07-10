/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ 668:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.debug = debug;
const core = __importStar(__nccwpck_require__(Object(function webpackMissingModule() { var e = new Error("Cannot find module '@actions/core'"); e.code = 'MODULE_NOT_FOUND'; throw e; }())));
function debug(title, content) {
    if (core.isDebug()) {
        core.info(`::group::${title}`);
        try {
            core.debug(JSON.stringify(content, null, 3));
        }
        catch (e) {
            core.debug(`Failed to serialize object, trying toString. Cause: ${e}`);
            core.debug(content?.toString());
        }
        core.info('::endgroup::');
    }
}


/***/ }),

/***/ 730:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {


// ----------------------------------------------------------------------------
// Copyright (c) Ben Coleman, 2020
// Licensed under the MIT License.
//
// Workflow Dispatch Action - Main task code
// ----------------------------------------------------------------------------
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
const core = __importStar(__nccwpck_require__(Object(function webpackMissingModule() { var e = new Error("Cannot find module '@actions/core'"); e.code = 'MODULE_NOT_FOUND'; throw e; }())));
const utils_1 = __nccwpck_require__(798);
const workflow_handler_1 = __nccwpck_require__(691);
const workflow_logs_handler_1 = __nccwpck_require__(265);
async function getFollowUrl(workflowHandler, interval, timeout) {
    const start = Date.now();
    let url;
    do {
        await (0, utils_1.sleep)(interval);
        try {
            const result = await workflowHandler.getWorkflowRunStatus();
            url = result.url;
        }
        catch (e) {
            core.debug(`Failed to get workflow url: ${e.message}`);
        }
    } while (!url && !(0, utils_1.isTimedOut)(start, timeout));
    return url;
}
async function waitForCompletionOrTimeout(workflowHandler, checkStatusInterval, waitForCompletionTimeout) {
    const start = Date.now();
    let status;
    let result;
    do {
        await (0, utils_1.sleep)(checkStatusInterval);
        try {
            result = await workflowHandler.getWorkflowRunStatus();
            status = result.status;
            core.debug(`Worflow is running for ${(0, utils_1.formatDuration)(Date.now() - start)}. Current status=${status}`);
        }
        catch (e) {
            core.warning(`Failed to get workflow status: ${e.message}`);
        }
    } while (status !== workflow_handler_1.WorkflowRunStatus.COMPLETED && !(0, utils_1.isTimedOut)(start, waitForCompletionTimeout));
    return { result, start };
}
function computeConclusion(start, waitForCompletionTimeout, result) {
    if ((0, utils_1.isTimedOut)(start, waitForCompletionTimeout)) {
        core.info('Workflow wait timed out');
        core.setOutput('workflow-conclusion', workflow_handler_1.WorkflowRunConclusion.TIMED_OUT);
        throw new Error('Workflow run has failed due to timeout');
    }
    core.info(`Workflow completed with conclusion=${result?.conclusion}`);
    const conclusion = result?.conclusion;
    core.setOutput('workflow-conclusion', conclusion);
    if (conclusion === workflow_handler_1.WorkflowRunConclusion.FAILURE)
        throw new Error('Workflow run has failed');
    if (conclusion === workflow_handler_1.WorkflowRunConclusion.CANCELLED)
        throw new Error('Workflow run was cancelled');
    if (conclusion === workflow_handler_1.WorkflowRunConclusion.TIMED_OUT)
        throw new Error('Workflow run has failed due to timeout');
}
async function handleLogs(args, workflowHandler) {
    try {
        const workflowRunId = await workflowHandler.getWorkflowRunId();
        await (0, workflow_logs_handler_1.handleWorkflowLogsPerJob)(args, workflowRunId);
    }
    catch (e) {
        core.error(`Failed to handle logs of triggered workflow. Cause: ${e}`);
    }
}
//
// Main task function (async wrapper)
//
async function run() {
    try {
        const args = (0, utils_1.getArgs)();
        const workflowHandler = new workflow_handler_1.WorkflowHandler(args.token, args.workflowRef, args.owner, args.repo, args.ref, args.runName);
        // Trigger workflow run
        await workflowHandler.triggerWorkflow(args.inputs);
        core.info('Workflow triggered 🚀');
        if (args.displayWorkflowUrl) {
            const url = await getFollowUrl(workflowHandler, args.displayWorkflowUrlInterval, args.displayWorkflowUrlTimeout);
            core.info(`You can follow the running workflow here: ${url}`);
            core.setOutput('workflow-url', url);
        }
        if (!args.waitForCompletion) {
            return;
        }
        core.info('Waiting for workflow completion');
        const { result, start } = await waitForCompletionOrTimeout(workflowHandler, args.checkStatusInterval, args.waitForCompletionTimeout);
        await handleLogs(args, workflowHandler);
        core.setOutput('workflow-id', result?.id);
        core.setOutput('workflow-url', result?.url);
        computeConclusion(start, args.waitForCompletionTimeout, result);
    }
    catch (error) {
        core.setFailed(error.message);
    }
}
//
// Call the main task run function
//
run();


/***/ }),

/***/ 798:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.getArgs = getArgs;
exports.getOctokit = getOctokit;
exports.sleep = sleep;
exports.isTimedOut = isTimedOut;
exports.formatDuration = formatDuration;
const core = __importStar(__nccwpck_require__(Object(function webpackMissingModule() { var e = new Error("Cannot find module '@actions/core'"); e.code = 'MODULE_NOT_FOUND'; throw e; }())));
const github = __importStar(__nccwpck_require__(Object(function webpackMissingModule() { var e = new Error("Cannot find module '@actions/github'"); e.code = 'MODULE_NOT_FOUND'; throw e; }())));
var TimeUnit;
(function (TimeUnit) {
    TimeUnit[TimeUnit["S"] = 1000] = "S";
    TimeUnit[TimeUnit["M"] = 60000] = "M";
    TimeUnit[TimeUnit["H"] = 3600000] = "H";
})(TimeUnit || (TimeUnit = {}));
function toMilliseconds(timeWithUnit) {
    const unitStr = timeWithUnit.substring(timeWithUnit.length - 1);
    const unit = TimeUnit[unitStr.toUpperCase()];
    if (!unit) {
        throw new Error('Unknown time unit ' + unitStr);
    }
    const time = parseFloat(timeWithUnit);
    return time * unit;
}
function parse(inputsJson) {
    if (inputsJson) {
        try {
            return JSON.parse(inputsJson);
        }
        catch (e) {
            throw new Error(`Failed to parse 'inputs' parameter. Must be a valid JSON.\nCause: ${e}`);
        }
    }
    return {};
}
function getArgs() {
    // Required inputs
    const token = core.getInput('token');
    const workflowRef = core.getInput('workflow');
    // Optional inputs, with defaults
    const ref = core.getInput('ref') || github.context.ref;
    const [owner, repo] = core.getInput('repo')
        ? core.getInput('repo').split('/')
        : [github.context.repo.owner, github.context.repo.repo];
    // Decode inputs, this MUST be a valid JSON string
    const inputs = parse(core.getInput('inputs'));
    const displayWorkflowUrlStr = core.getInput('display-workflow-run-url');
    const displayWorkflowUrl = displayWorkflowUrlStr && displayWorkflowUrlStr === 'true';
    const displayWorkflowUrlTimeout = toMilliseconds(core.getInput('display-workflow-run-url-timeout'));
    const displayWorkflowUrlInterval = toMilliseconds(core.getInput('display-workflow-run-url-interval'));
    const waitForCompletionStr = core.getInput('wait-for-completion');
    const waitForCompletion = waitForCompletionStr && waitForCompletionStr === 'true';
    const waitForCompletionTimeout = toMilliseconds(core.getInput('wait-for-completion-timeout'));
    const checkStatusInterval = toMilliseconds(core.getInput('wait-for-completion-interval'));
    const runName = core.getInput('run-name');
    const workflowLogMode = core.getInput('workflow-logs');
    return {
        token,
        workflowRef,
        ref,
        owner,
        repo,
        inputs,
        displayWorkflowUrl,
        displayWorkflowUrlTimeout,
        displayWorkflowUrlInterval,
        checkStatusInterval,
        waitForCompletion,
        waitForCompletionTimeout,
        runName,
        workflowLogMode
    };
}
// GitHub is sunsetting unversioned requests (they currently fall back to the oldest API
// version's behaviour) - see https://docs.github.com/en/rest/about-the-rest-api/api-versions.
// octokit does not send this header by default, so every REST call must opt in explicitly.
const GITHUB_API_VERSION = '2022-11-28';
function getOctokit(token) {
    return github.getOctokit(token, {
        request: { headers: { 'x-github-api-version': GITHUB_API_VERSION } }
    });
}
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
function isTimedOut(start, waitForCompletionTimeout) {
    return Date.now() > start + waitForCompletionTimeout;
}
function formatDuration(duration) {
    const durationSeconds = duration / 1000;
    const hours = Math.floor(durationSeconds / 3600);
    const minutes = Math.floor((durationSeconds - (hours * 3600)) / 60);
    const seconds = durationSeconds - (hours * 3600) - (minutes * 60);
    let hoursStr = hours + '';
    let minutesStr = minutes + '';
    let secondsStr = seconds + '';
    if (hours < 10) {
        hoursStr = '0' + hoursStr;
    }
    if (minutes < 10) {
        minutesStr = '0' + minutesStr;
    }
    if (seconds < 10) {
        secondsStr = '0' + secondsStr;
    }
    return hoursStr + 'h ' + minutesStr + 'm ' + secondsStr + 's';
}


/***/ }),

/***/ 691:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.WorkflowHandler = exports.WorkflowRunConclusion = exports.WorkflowRunStatus = void 0;
const core = __importStar(__nccwpck_require__(Object(function webpackMissingModule() { var e = new Error("Cannot find module '@actions/core'"); e.code = 'MODULE_NOT_FOUND'; throw e; }())));
const debug_1 = __nccwpck_require__(668);
const utils_1 = __nccwpck_require__(798);
var WorkflowRunStatus;
(function (WorkflowRunStatus) {
    WorkflowRunStatus["QUEUED"] = "queued";
    WorkflowRunStatus["IN_PROGRESS"] = "in_progress";
    WorkflowRunStatus["COMPLETED"] = "completed";
})(WorkflowRunStatus || (exports.WorkflowRunStatus = WorkflowRunStatus = {}));
const ofStatus = (status) => {
    if (!status) {
        return WorkflowRunStatus.QUEUED;
    }
    const key = status.toUpperCase();
    return WorkflowRunStatus[key];
};
var WorkflowRunConclusion;
(function (WorkflowRunConclusion) {
    WorkflowRunConclusion["SUCCESS"] = "success";
    WorkflowRunConclusion["FAILURE"] = "failure";
    WorkflowRunConclusion["CANCELLED"] = "cancelled";
    WorkflowRunConclusion["SKIPPED"] = "skipped";
    WorkflowRunConclusion["NEUTRAL"] = "neutral";
    WorkflowRunConclusion["TIMED_OUT"] = "timed_out";
    WorkflowRunConclusion["ACTION_REQUIRED"] = "action_required";
})(WorkflowRunConclusion || (exports.WorkflowRunConclusion = WorkflowRunConclusion = {}));
const ofConclusion = (conclusion) => {
    if (!conclusion) {
        return WorkflowRunConclusion.NEUTRAL;
    }
    const key = conclusion.toUpperCase();
    return WorkflowRunConclusion[key];
};
class WorkflowHandler {
    workflowRef;
    owner;
    repo;
    ref;
    runName;
    octokit;
    workflowId;
    workflowRunId;
    triggerDate = 0;
    constructor(token, workflowRef, owner, repo, ref, runName) {
        this.workflowRef = workflowRef;
        this.owner = owner;
        this.repo = repo;
        this.ref = ref;
        this.runName = runName;
        // Get octokit client for making API calls
        this.octokit = (0, utils_1.getOctokit)(token);
    }
    async triggerWorkflow(inputs) {
        try {
            const workflowId = await this.getWorkflowId();
            this.triggerDate = new Date().setMilliseconds(0);
            const dispatchResp = await this.octokit.rest.actions.createWorkflowDispatch({
                owner: this.owner,
                repo: this.repo,
                workflow_id: workflowId,
                ref: this.ref,
                inputs
            });
            (0, debug_1.debug)('Workflow Dispatch', dispatchResp);
        }
        catch (error) {
            (0, debug_1.debug)('Workflow Dispatch error', error.message);
            throw error;
        }
    }
    async getWorkflowRunStatus() {
        try {
            const runId = await this.getWorkflowRunId();
            const response = await this.octokit.rest.actions.getWorkflowRun({
                owner: this.owner,
                repo: this.repo,
                run_id: runId
            });
            (0, debug_1.debug)('Workflow Run status', response);
            return {
                id: runId,
                url: response.data.html_url,
                status: ofStatus(response.data.status),
                conclusion: ofConclusion(response.data.conclusion)
            };
        }
        catch (error) {
            (0, debug_1.debug)('Workflow Run status error', error);
            throw error;
        }
    }
    async getWorkflowRunArtifacts() {
        try {
            const runId = await this.getWorkflowRunId();
            const response = await this.octokit.rest.actions.getWorkflowRunArtifacts({
                owner: this.owner,
                repo: this.repo,
                run_id: runId
            });
            (0, debug_1.debug)('Workflow Run artifacts', response);
            return {
                id: runId,
                url: response.data.html_url,
                status: ofStatus(response.data.status),
                conclusion: ofConclusion(response.data.conclusion)
            };
        }
        catch (error) {
            (0, debug_1.debug)('Workflow Run artifacts error', error);
            throw error;
        }
    }
    async findAllWorkflowRuns() {
        try {
            const workflowId = await this.getWorkflowId();
            const response = await this.octokit.rest.actions.listWorkflowRuns({
                owner: this.owner,
                repo: this.repo,
                workflow_id: workflowId,
                event: 'workflow_dispatch',
                created: `>=${new Date(this.triggerDate).toISOString()}`
            });
            (0, debug_1.debug)('List Workflow Runs', response);
            return response.data.workflow_runs;
        }
        catch (error) {
            (0, debug_1.debug)('Fin all workflow runs error', error);
            throw new Error(`Failed to list workflow runs. Cause: ${error}`);
        }
    }
    async getWorkflowRunId() {
        if (this.workflowRunId) {
            return this.workflowRunId;
        }
        try {
            let runs = await this.findAllWorkflowRuns();
            if (this.runName) {
                runs = runs.filter((r) => r.name == this.runName);
            }
            if (runs.length == 0) {
                throw new Error('Run not found');
            }
            if (runs.length > 1) {
                core.warning(`Found ${runs.length} runs. Using the last one.`);
                await this.debugFoundWorkflowRuns(runs);
            }
            this.workflowRunId = runs[0].id;
            return this.workflowRunId;
        }
        catch (error) {
            (0, debug_1.debug)('Get workflow run id error', error);
            throw error;
        }
    }
    async getWorkflowId() {
        if (this.workflowId) {
            return this.workflowId;
        }
        if (this.isFilename(this.workflowRef)) {
            this.workflowId = this.workflowRef;
            core.debug(`Workflow id is: ${this.workflowRef}`);
            return this.workflowId;
        }
        try {
            const workflowsResp = await this.octokit.rest.actions.listRepoWorkflows({
                owner: this.owner,
                repo: this.repo
            });
            const workflows = workflowsResp.data.workflows;
            (0, debug_1.debug)('List Workflows', workflows);
            // Locate workflow either by name or id
            const workflowFind = workflows.find((workflow) => workflow.name === this.workflowRef || workflow.id.toString() === this.workflowRef);
            if (!workflowFind)
                throw new Error(`Unable to find workflow '${this.workflowRef}' in ${this.owner}/${this.repo} 😥`);
            core.debug(`Workflow id is: ${workflowFind.id}`);
            this.workflowId = workflowFind.id;
            return this.workflowId;
        }
        catch (error) {
            (0, debug_1.debug)('List workflows error', error);
            throw error;
        }
    }
    isFilename(workflowRef) {
        return /.+\.ya?ml$/.test(workflowRef);
    }
    debugFoundWorkflowRuns(runs) {
        (0, debug_1.debug)(`Filtered Workflow Runs (after trigger date: ${new Date(this.triggerDate).toISOString()})`, runs.map((r) => ({
            id: r.id,
            name: r.name,
            created_at: r.created_at,
            triggerDate: new Date(this.triggerDate).toISOString(),
            created_at_ts: new Date(r.created_at).valueOf(),
            triggerDateTs: this.triggerDate
        })));
    }
}
exports.WorkflowHandler = WorkflowHandler;


/***/ }),

/***/ 265:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.handleWorkflowLogsPerJob = handleWorkflowLogsPerJob;
const core = __importStar(__nccwpck_require__(Object(function webpackMissingModule() { var e = new Error("Cannot find module '@actions/core'"); e.code = 'MODULE_NOT_FOUND'; throw e; }())));
const debug_1 = __nccwpck_require__(668);
const utils_1 = __nccwpck_require__(798);
async function handleWorkflowLogsPerJob(args, workflowRunId) {
    const mode = args.workflowLogMode;
    const token = args.token;
    const owner = args.owner;
    const repo = args.repo;
    const handler = logHandlerFactory(mode);
    if (handler == null) {
        return;
    }
    const octokit = (0, utils_1.getOctokit)(token);
    const runId = workflowRunId;
    const response = await octokit.rest.actions.listJobsForWorkflowRun({
        owner: owner,
        repo: repo,
        run_id: runId
    });
    await handler.handleJobList(response.data.jobs);
    for (const job of response.data.jobs) {
        try {
            const jobLog = await octokit.rest.actions.downloadJobLogsForWorkflowRun({
                owner: owner,
                repo: repo,
                job_id: job.id,
            });
            await handler.handleJobLogs(job, jobLog.data);
        }
        catch (error) {
            await handler.handleError(job, error);
        }
    }
    switch (mode) {
        case 'json-output':
            core.setOutput('workflow-logs', handler.getJsonLogs());
            break;
        case 'output':
            core.setOutput('workflow-logs', handler.getRawLogs());
            break;
        default:
            break;
    }
}
class PrintLogsHandler {
    async handleJobList(jobs) {
        (0, debug_1.debug)('Retrieving logs for jobs in workflow', jobs);
    }
    async handleJobLogs(job, logs) {
        core.startGroup(`Logs of job '${job.name}'`);
        core.info(escapeImportedLogs(logs));
        core.endGroup();
    }
    async handleError(job, error) {
        core.warning(escapeImportedLogs(error.message));
    }
}
class OutputLogsHandler {
    logs = new Map();
    async handleJobList(jobs) {
        (0, debug_1.debug)('Retrieving logs for jobs in workflow', jobs);
    }
    async handleJobLogs(job, logs) {
        this.logs.set(job.name, logs);
    }
    async handleError(job, error) {
        core.warning(escapeImportedLogs(error.message));
    }
    getJsonLogs() {
        const result = {};
        const logPattern = /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{7}Z)\s+(.*)/;
        this.logs.forEach((logs, jobName) => {
            result[jobName] = [];
            for (const line of logs.split('\n')) {
                if (line === '') {
                    continue;
                }
                const splitted = line.split(logPattern);
                result[jobName].push({
                    datetime: splitted[1],
                    message: splitted[2]
                });
            }
            // result[jobName] = logs;
        });
        return JSON.stringify(result);
    }
    getRawLogs() {
        let result = '';
        this.logs.forEach((logs, jobName) => {
            for (const line of logs.split('\n')) {
                result += `${jobName} | ${line}\n`;
            }
        });
        return result;
    }
}
function logHandlerFactory(mode) {
    switch (mode) {
        case 'print':
            return new PrintLogsHandler();
        case 'output':
        case 'json-output':
            return new OutputLogsHandler();
        default:
            return null;
    }
}
function escapeImportedLogs(str) {
    return str.replace(/^/mg, '| ')
        .replace(/##\[([^\]]+)\]/gm, '##<$1>');
}


/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __nccwpck_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		var threw = true;
/******/ 		try {
/******/ 			__webpack_modules__[moduleId].call(module.exports, module, module.exports, __nccwpck_require__);
/******/ 			threw = false;
/******/ 		} finally {
/******/ 			if(threw) delete __webpack_module_cache__[moduleId];
/******/ 		}
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat */
/******/ 	
/******/ 	if (typeof __nccwpck_require__ !== 'undefined') __nccwpck_require__.ab = __dirname + "/";
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module is referenced by other modules so it can't be inlined
/******/ 	var __webpack_exports__ = __nccwpck_require__(730);
/******/ 	module.exports = __webpack_exports__;
/******/ 	
/******/ })()
;