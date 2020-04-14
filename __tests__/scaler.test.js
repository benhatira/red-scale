const RedScale = require('../index')

describe('scaleWorker', () => {
  describe('getIdealWorkerTarget', () => {
    it('maintain at min_worker when job = 0', () => {
      const args = {
        workerToJobRatio: 0.5,
        cpuPerMachine: 16,
        fixUsedCpu: 6,
        minWorker: 8,
        maxWorker: 2000
      }
      // from ratio 5 => 2.5
      // maximizeCPU => 0_(2.5)_16 = 16
      // minus fixUsed  because  16 - 6 = 10
      expect(RedScale.getIdealWorkerTarget(Object.assign({ jobCount: 0 }, args ))).toEqual(8)
    })

    it('maintain at cpuPerMachine - fixUsed when target > min but < cpuPerMachine', () => {
      const args = {
        workerToJobRatio: 0.5,
        cpuPerMachine: 16,
        fixUsedCpu: 6,
        minWorker: 8,
        maxWorker: 2000
      }
      // from ratio 5 => 2.5
      // maximizeCPU => 0_(2.5)_16 = 16
      // minus fixUsed  because  16 - 6 = 10
      expect(RedScale.getIdealWorkerTarget(Object.assign({ jobCount: 5 }, args ))).toEqual(10)
    })


    it('maintain at target - fixUsedCPU when workerTarget exceed CpuPerMachine', () => {
      const args = {
        workerToJobRatio: 0.5,
        cpuPerMachine: 16,
        boostMinWorker: 16,
        fixUsedCpu: 4,
        minWorker: 16,
        maxWorker: 2000
      }
      // from ratio 40 => 20
      // maximizeCPU => 16 -20- 32 => 32
      // minuse fixUsed  32 - 4 = 28
      expect(RedScale.getIdealWorkerTarget(Object.assign({ jobCount: 40 }, args ))).toEqual(28)
    })


    it('initial scale to boost_min_worker when min_worker < (job_count / 2) < min_boost_worker', () => {
      const args = {
        workerToJobRatio: 0.5,
        cpuPerMachine: 16,
        boostMinWorker: 160,
        minWorker: 16,
        maxWorker: 2000
      }
      // 33(0.5) => 17 | 17 => 160
      expect(RedScale.getIdealWorkerTarget(Object.assign({ jobCount: 33 }, args ))).toEqual(args.boostMinWorker)
      // 200(0.5) => 100 | 100 => 160
      expect(RedScale.getIdealWorkerTarget(Object.assign({ jobCount: 200 }, args ))).toEqual(args.boostMinWorker)
      // 300(0.5) => 150 | 150 => 160
      expect(RedScale.getIdealWorkerTarget(Object.assign({ jobCount: 300 }, args ))).toEqual(args.boostMinWorker)
    })

    it('scale to target when min_boost_worker < target < max_worker', () => {
      const args = {
        workerToJobRatio: 0.5,
        cpuPerMachine: 16,
        boostMinWorker: 160,
        minWorker: 16,
        maxWorker: 2000
      }

      // 321(0.5) => 161 | 161 => 176
      expect(RedScale.getIdealWorkerTarget(Object.assign({ jobCount: 321 }, args ))).toEqual(176)
      // 800(0.5) => 400 | 400 => 400(16 * 25)
      expect(RedScale.getIdealWorkerTarget(Object.assign({ jobCount: 800 }, args ))).toEqual(400)
    })

    it('scale to target when (min_boost_worker < target < max_worker) with fixUsedCpu', () => {
      const args = {
        workerToJobRatio: 0.5,
        cpuPerMachine: 16,
        boostMinWorker: 32,
        fixUsedCpu: 6,
        minWorker: 16,
        maxWorker: 2000
      }
      // 70(0.5) => 35 | 32_(35)_48 => 48 | 48 - 6 => 42
      expect(RedScale.getIdealWorkerTarget(Object.assign({ jobCount: 70 }, args ))).toEqual(42)
      // 122(0.5) => 61 | 48_(61)_64 => 64 | 64 - 6 => 58
      expect(RedScale.getIdealWorkerTarget(Object.assign({ jobCount: 122 }, args ))).toEqual(58)
    })

    it('scale to max_worker when (job_count / 2) > max_worker', () => {
      const args = {
        workerToJobRatio: 0.5,
        cpuPerMachine: 16,
        boostMinWorker: 160,
        minWorker: 16,
        maxWorker: 2000
      }
      expect(RedScale.getIdealWorkerTarget(Object.assign({ jobCount: 4001 }, args ))).toEqual(2000)
      expect(RedScale.getIdealWorkerTarget(Object.assign({ jobCount: 5000 }, args ))).toEqual(2000)
    })
    
    it('scale to max_worker target > max_worker and minus used CPU if workerTarger more than CPU/machine', () => {
      const args = {
        workerToJobRatio: 1,
        cpuPerMachine: 16,
        fixUsedCpu: 4,
        boostMinWorker: 160,
        minWorker: 16,
        maxWorker: 1600
      }
      expect(RedScale.getIdealWorkerTarget(Object.assign({ jobCount: 1600 }, args ))).toEqual(1596)
      expect(RedScale.getIdealWorkerTarget(Object.assign({ jobCount: 1605 }, args ))).toEqual(1600)
    })
  })

  describe('scale', () => {
    it('should scale up when getIdealWorkerTarget return a target than exceed currentWorker', async () => {
      const scaler = new RedScale({
        minWorker: 12
      })
      scaler.doScale = jest.fn()
      scaler.updateJobStats = jest.fn(() => ({ total: 100 }))
      // this is something exceed minWorker

      RedScale.getIdealWorkerTarget = jest.fn(() => 50)
      await scaler.scale()
      expect(scaler.doScale).toHaveBeenCalledTimes(1)
      expect(scaler.doScale).toHaveBeenCalledWith({ stats: { total: 100 }, scaleTo: 50 })
    })
  })

  describe('getCurrentNumberOfJobs', () => {
    test('should return an object consist of number of active, inactive and total', async () => {
      const scaler = new RedScale()
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

  describe('start', () => {
    test('should create schedule from scaleInvertal settings', async () => {
      const scaler = new RedScale({
        scaleInterval: 1000
      })
      scaler.scale = jest.fn()
      scaler.start()
      await new Promise((r) => setTimeout(r, 3100))
      expect(scaler.scale).toHaveBeenCalledTimes(3)
    })
  })
})
