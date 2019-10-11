const debug = require('debug')('workerScaler')
/**
 * Scale worker to half of total jobs in the system (active + inactive)
 * freeze it at half of max jobs, so that no job get shutdown before
 * it is done (unless preemptive instance shut itself down)
 * with 1/2 max job, the total amount of time it takes to finish a batch is
 * = scale up time + 2 * job time
 *
 * Maximum wasted time = job time * number of pods
 * if we capped the number of pods at 2000 pods / 16 pods per instance = 125 instance
 * = 10 minutes * 125 instance = 1250 minute of wasted time
 *
 * Things to watch out for:
 *  - job stuck in active/inactive state, should make sure there are no stuck job
 *    otherwise the worker might now scale down, resulting in a massive cost
 *
 * @returns
 */

class WorkerScaler {
  /**
   *
   */
  constructor({
    workerToJobRatio = 1,
    cpuPerMachine = 1,
    boostMinWorker = 1,
    minWorker = 1,
    maxWorker = 6
  } = {}) {
    this.currentWorker = 0
    this.workerToJobRatio = workerToJobRatio
    this.cpuPerMachine = cpuPerMachine
    this.boostMinWorker = boostMinWorker
    this.minWorker = minWorker
    this.maxWorker = maxWorker

    this.doScale = (scaleTo) => {
      console.log(`!no doScale function to execute scaleTo(${scaleTo})`)
    }
    this.updateJobStats = () => {
      console.log('!no updateJobStats function to execute')
      return {
        total: 0,
        inactive: 0,
        active: 0
      }
    }
  }



  static ceilToNearest(jobCount, workerToJobRatio, cpuPerMachine) {
    return Math.ceil(jobCount * workerToJobRatio / cpuPerMachine) * cpuPerMachine
  }

  static getIdealWorkerTarget({
    jobCount,
    workerToJobRatio,
    cpuPerMachine,
    boostMinWorker,
    minWorker,
    maxWorker
  }) {
    let workerTarget = WorkerScaler.ceilToNearest(jobCount, workerToJobRatio, cpuPerMachine)

    // 
    if (workerTarget < minWorker) {
      workerTarget = minWorker
    }

    // Scale to 'boostMinWorker' in advance to speed up total run time.
    // we think that if job come in more than the minWorker,
    // it probably be a full market run (>100 jobs)
    if (workerTarget > minWorker && workerTarget < boostMinWorker) {
      workerTarget = boostMinWorker
    }

    // the missing gap in conditional statement is for the case that
    // workerTarget > boostMinWorker, which we will use the 'workerTarget'

    if (workerTarget > maxWorker) {
      workerTarget = maxWorker
    }

    return workerTarget
  }

  async getCurrentNumberOfJobs() {
    const { total, inactive, active } = await this.updateJobStats()
    return {
      total,
      inactive,
      active
    }
  }

  async scale() {
    const count = await this.getCurrentNumberOfJobs()
    const idealWorkerTarget = WorkerScaler.getIdealWorkerTarget({
      jobCount: count.total,
      workerToJobRatio: this.workerToJobRatio,
      cpuPerMachine: this.cpuPerMachine,
      boostMinWorker: this.boostMinWorker,
      minWorker: this.minWorker,
      maxWorker: this.maxWorker
    })

    this.currentWorker = idealWorkerTarget
    console.log(`Total: ${count.total}, active/queue: ${count.active}/${count.inactive} => scale to ${this.currentWorker}`)
    return this.doScale(this.currentWorker)
  }
}

module.exports = WorkerScaler
