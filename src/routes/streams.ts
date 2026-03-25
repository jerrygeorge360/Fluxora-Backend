import { Router } from 'express';
import {
  CHAIN_STREAM_STATUSES,
  ChainStreamStatus,
  defaultChainStatusForStartTime,
  isChainStreamStatus,
  mapChainStatusToApiStatus,
} from '../streams/status.js';

export const streamsRouter = Router();

// Placeholder: replace with DB and contract sync later
const streams: Array<{
  id: string;
  sender: string;
  recipient: string;
  depositAmount: string;
  ratePerSecond: string;
  startTime: number;
  chainStatus: ChainStreamStatus;
}> = [];

function serializeStream(stream: (typeof streams)[number]) {
  return {
    id: stream.id,
    sender: stream.sender,
    recipient: stream.recipient,
    depositAmount: stream.depositAmount,
    ratePerSecond: stream.ratePerSecond,
    startTime: stream.startTime,
    ...mapChainStatusToApiStatus(stream.chainStatus),
  };
}

streamsRouter.get('/', (_req, res) => {
  res.json({ streams: streams.map(serializeStream) });
});

streamsRouter.get('/:id', (req, res) => {
  const stream = streams.find((s) => s.id === req.params.id);
  if (!stream) return res.status(404).json({ error: 'Stream not found' });
  res.json(serializeStream(stream));
});

streamsRouter.post('/', (req, res) => {
  const { sender, recipient, depositAmount, ratePerSecond, startTime, chainStatus } = req.body ?? {};

  const normalizedStartTime = typeof startTime === 'number'
    ? startTime
    : Math.floor(Date.now() / 1000);

  if (chainStatus !== undefined && !isChainStreamStatus(chainStatus)) {
    return res.status(400).json({
      error: 'Invalid chain status',
      allowedChainStatuses: CHAIN_STREAM_STATUSES,
    });
  }

  const id = `stream-${Date.now()}`;
  const stream = {
    id,
    sender: sender ?? '',
    recipient: recipient ?? '',
    depositAmount: depositAmount ?? '0',
    ratePerSecond: ratePerSecond ?? '0',
    startTime: normalizedStartTime,
    chainStatus: chainStatus ?? defaultChainStatusForStartTime(normalizedStartTime),
  };
  streams.push(stream);
  res.status(201).json(serializeStream(stream));
});
