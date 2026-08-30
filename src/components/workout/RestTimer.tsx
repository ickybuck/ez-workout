import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { Clock, Pause, Play, Plus, Minus, RotateCcw } from 'lucide-react';

interface RestTimerProps {
  defaultDuration: number;
  autoStart: boolean;
  onComplete?: () => void;
}

export interface RestTimerRef {
  resetTimer: () => void;
}

const RestTimer = forwardRef<RestTimerRef, RestTimerProps>(({ 
  defaultDuration, 
  autoStart, 
  onComplete,
}, ref) => {
  const [timeLeft, setTimeLeft] = useState(defaultDuration);
  const [isPaused, setIsPaused] = useState(!autoStart);
  const timerRef = useRef<number>();
  const audioRef = useRef<HTMLAudioElement>();

  useEffect(() => {
    setTimeLeft(defaultDuration);
  }, [defaultDuration]);

  useEffect(() => {
    // Create audio element for beep sound
    // This creates a 1000Hz sine wave beep for 0.3 seconds (increased from 0.1)
    const sampleRate = 44100;
    const duration = 0.3; // Increased from 0.1 to 0.3 seconds
    const frequency = 1000;
    
    const audioContext = new AudioContext();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    const audioBuffer = audioContext.createBuffer(1, sampleRate * duration, sampleRate);
    const channelData = audioBuffer.getChannelData(0);
    
    for (let i = 0; i < audioBuffer.length; i++) {
      channelData[i] = Math.sin(2 * Math.PI * frequency * i / sampleRate);
    }
    
    // Apply fade in/out to avoid clicks
    const fadeLength = sampleRate * 0.01; // 10ms fade
    for (let i = 0; i < fadeLength; i++) {
      channelData[i] *= i / fadeLength;
      channelData[channelData.length - 1 - i] *= i / fadeLength;
    }
    
    const offlineContext = new OfflineAudioContext(1, sampleRate * duration, sampleRate);
    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineContext.destination);
    source.start();
    
    offlineContext.startRendering().then(renderedBuffer => {
      const wav = new Blob([createWaveFileData(renderedBuffer)], { type: 'audio/wav' });
      audioRef.current = new Audio(URL.createObjectURL(wav));
    });
    
    return () => {
      if (audioRef.current) {
        URL.revokeObjectURL(audioRef.current.src);
        audioRef.current = undefined;
      }
    };
  }, []);

  useEffect(() => {
    if (!isPaused && timeLeft > 0) {
      timerRef.current = window.setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            if (audioRef.current) {
              audioRef.current.play();
            }
            if (onComplete) {
              onComplete();
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isPaused, timeLeft, onComplete]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const togglePause = () => {
    setIsPaused(prev => !prev);
  };

  const addTime = () => {
    setTimeLeft(prev => prev + 10);
  };

  const subtractTime = () => {
    setTimeLeft(prev => Math.max(0, prev - 10));
  };

  const resetTimer = () => {
    setTimeLeft(defaultDuration);
    setIsPaused(false);
  };

  // Expose resetTimer method to parent component
  useImperativeHandle(ref, () => ({
    resetTimer,
  }));

  // Calculate progress percentage (0% = full time, 100% = time expired)
  const progressPercentage = ((defaultDuration - timeLeft) / defaultDuration) * 100;

  return (
    <div
      className="relative flex items-center justify-between py-2 px-4 bg-surface rounded-lg overflow-hidden"
    >
      {/* Progress bar background */}
      <div
        className="absolute inset-0 bg-positive-soft transition-all duration-1000 ease-linear"
        style={{
          width: `${progressPercentage}%`,
        }}
      />

      {/* Content on top of progress bar */}
      <div className="relative flex items-center gap-2">
        <Clock className="h-5 w-5 text-content-subtle" />
        <div className="font-mono text-lg tabular-nums">{formatTime(timeLeft)}</div>
      </div>
      <div className="relative flex items-center gap-2">
        <button
          onClick={resetTimer}
          className="p-2.5 text-content-subtle hover:text-accent hover:bg-accent-soft rounded-full"
          title="Reset timer"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
        <button
          onClick={togglePause}
          className="p-2.5 text-content-subtle hover:text-accent hover:bg-accent-soft rounded-full"
          title={isPaused ? "Start timer" : "Pause timer"}
        >
          {isPaused ? (
            <Play className="h-4 w-4" />
          ) : (
            <Pause className="h-4 w-4" />
          )}
        </button>
        <button
          onClick={subtractTime}
          className="p-2.5 text-content-subtle hover:text-accent hover:bg-accent-soft rounded-full"
          title="Subtract 10 seconds"
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          onClick={addTime}
          className="p-2.5 text-content-subtle hover:text-accent hover:bg-accent-soft rounded-full"
          title="Add 10 seconds"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
});

// Helper function to create WAV file data
function createWaveFileData(audioBuffer: AudioBuffer): ArrayBuffer {
  const format = 1; // PCM
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = audioBuffer.length * blockAlign;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;
  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);

  // Write WAV header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, totalSize - 8, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Write audio data
  const channelData = audioBuffer.getChannelData(0);
  let offset = 44;
  for (let i = 0; i < audioBuffer.length; i++) {
    const sample = Math.max(-1, Math.min(1, channelData[i]));
    view.setInt16(offset, sample * 0x7FFF, true);
    offset += 2;
  }

  return buffer;
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

export default RestTimer;