import { Camera, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * Live camera capture using the device camera. There is no simulated capture:
 * if the browser has no camera API or permission is refused, the caller is told
 * so and the upload path is used instead.
 */
export function CameraCapture({
  onCapture,
  onClose,
}: {
  onCapture: (dataUrl: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function start() {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setError("This device or browser does not give websites access to a camera. Please upload a photo instead.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        setReady(true);
      } catch {
        setError("Camera permission was refused or the camera is in use. Please allow access or upload a photo instead.");
      }
    }
    void start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function shoot() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    onCapture(canvas.toDataURL("image/jpeg", 0.92));
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95">
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <span className="text-sm font-medium">Position the label inside the frame</span>
        <button onClick={onClose} aria-label="Close camera" className="rounded-full p-2 hover:bg-white/10">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="flex flex-1 items-center justify-center px-3">
        {error ? (
          <p className="max-w-sm rounded-xl bg-white/10 p-4 text-center text-sm text-white">{error}</p>
        ) : (
          <video ref={videoRef} playsInline muted className="max-h-full w-full rounded-2xl object-contain" />
        )}
      </div>
      <div className="flex justify-center py-6">
        <button
          onClick={shoot}
          disabled={!ready}
          className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-white text-black disabled:opacity-40"
          aria-label="Take photo"
        >
          <Camera className="h-7 w-7" />
        </button>
      </div>
    </div>
  );
}
