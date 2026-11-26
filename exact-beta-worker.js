try {
  const response = await fetch(new URL('./exact-beta/inputs.json?v=67f0054380987872', import.meta.url));
  if (!response.ok) throw Error('Exact beta inputs unavailable.');
  const {enabled, seedRows} = await response.json();
  if (!enabled) throw Error('Exact beta proof inputs have changed.');
  const {runFullOrdinaryPhase} = await import('./exact-beta/m4-full-ordinary-study.mjs?v=67f0054380987872');
  self.onmessage = ({data}) => {
    try {
      if (data.partitionCount) {
        self.postMessage({plan: runFullOrdinaryPhase({partitionCount: data.partitionCount})});
        return;
      }
      const {phase, partition, balancedWindow, balancedSeed, deadlineMs} = data;
      const result = runFullOrdinaryPhase({seedRows, partition, deadlineMs,
        balancedWindow, balancedSeed, endpointArchive: phase === 'endpoints',
        progress: state => self.postMessage({progress: {...state, phase}})});
      const {outputs, proven, pending, certificate, archive, mountNodes, scores,
        expectedMountCount, elapsedMs} = result;
      self.postMessage({result: {outputs, proven, pending, certificate, archive,
        mountNodes, scores, expectedMountCount, elapsedMs}});
    } catch (error) {
      self.postMessage({error: error.message});
    }
  };
  self.postMessage({ready: true});
} catch (error) {
  self.postMessage({error: error.message});
}
