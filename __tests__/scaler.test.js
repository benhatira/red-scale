const WorkerScaler = require('../index')

describe('scaleWorker', () => {
  describe(('getIdealWorkerTarget'), () => {
    it('maintain at min_worker when (job_count / 2) < min_worker', () => {
      const args = {
        workerToJobRatio: 0.5,
        cpuPerMachine: 16,
        boostMinWorker: 160,
        minWorker: 16,
        maxWorker: 2000
      }
      expect(WorkerScaler.getIdealWorkerTarget(Object.assign({ jobCount: 5 }, args ))).toEqual(args.minWorker)
      expect(WorkerScaler.getIdealWorkerTarget(Object.assign({ jobCount: 5 }, args ))).toEqual(args.minWorker)
    })

    it('initial scale to boost_min_worker when min_worker < (job_count / 2) < min_boost_worker', () => {
      const args = {
        workerToJobRatio: 0.5,
        cpuPerMachine: 16,
        boostMinWorker: 160,
        minWorker: 16,
        maxWorker: 2000
      }
      expect(WorkerScaler.getIdealWorkerTarget(Object.assign({ jobCount: 33 }, args ))).toEqual(args.boostMinWorker)
      expect(WorkerScaler.getIdealWorkerTarget(Object.assign({ jobCount: 200 }, args ))).toEqual(args.boostMinWorker)
      expect(WorkerScaler.getIdealWorkerTarget(Object.assign({ jobCount: 300 }, args ))).toEqual(args.boostMinWorker)
    })

    it('scale to (job_count / 2) when min_boost_worker < (job_count / 2) < max_worker', () => {
      const args = {
        workerToJobRatio: 0.5,
        cpuPerMachine: 16,
        boostMinWorker: 160,
        minWorker: 16,
        maxWorker: 2000
      }
      let nearestCeiling1 = WorkerScaler.ceilToNearest(321, args.workerToJobRatio, args.cpuPerMachine)
      expect(WorkerScaler.getIdealWorkerTarget(Object.assign({ jobCount: 321 }, args ))).toEqual(nearestCeiling1)
      let nearestCeiling2 = WorkerScaler.ceilToNearest(800, args.workerToJobRatio, args.cpuPerMachine)
      expect(WorkerScaler.getIdealWorkerTarget(Object.assign({ jobCount: 800 }, args ))).toEqual(nearestCeiling2)
    })

    it('scale to max_worker when (job_count / 2) > max_worker', () => {
      const args = {
        workerToJobRatio: 0.5,
        cpuPerMachine: 16,
        boostMinWorker: 160,
        minWorker: 16,
        maxWorker: 2000
      }
      expect(WorkerScaler.getIdealWorkerTarget(Object.assign({ jobCount: 4001 }, args ))).toEqual(args.maxWorker)
      expect(WorkerScaler.getIdealWorkerTarget(Object.assign({ jobCount: 5000 }, args ))).toEqual(args.maxWorker)
    })
  })

  describe('scale', () => {
    it('should scale up when getIdealWorkerTarget return a target than exceed currentWorker', async () => {
      const scaler = new WorkerScaler({
        minWorker: 12
      })
      scaler.doScale = jest.fn()
      // this is something exceed minWorker
      WorkerScaler.getIdealWorkerTarget = jest.fn(() => 50)
      await scaler.scale()
      expect(scaler.doScale).toHaveBeenCalledTimes(1)
      expect(scaler.doScale).toHaveBeenCalledWith(50)
    })
  })

  describe('getCurrentNumberOfJobs', () => {
    test('should return an object consist of number of active, inactive and total', async () => {
      const scaler = new WorkerScaler()
      scaler.updateJobStats = jest.fn(() => ({
        total: 15,
        active: 10,
        inactive: 5
      }))
      const count = await scaler.getCurrentNumberOfJobs()
      expect(count.total).toEqual(15)
      expect(count.active).toEqual(10)
      expect(count.inactive).toEqual(5)
    })
  })
})
