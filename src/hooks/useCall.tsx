import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { playNotificationSound } from "@/lib/notificationSound";

export interface CallState {
  callId: string;
  conversationId: string;
  callerId: string;
  callerName: string;
  callType: "voice" | "video";
  status: "ringing" | "active" | "ended" | "missed" | "declined";
  isOutgoing: boolean;
}

export function useCall() {
  const { user } = useAuth();
  const [activeCall, setActiveCall] = useState<CallState | null>(null);
  const [incomingCall, setIncomingCall] = useState<CallState | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isSpeaker, setIsSpeaker] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isPipMode, setIsPipMode] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const originalVideoTrackRef = useRef<MediaStreamTrack | null>(null);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const signalingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const ringtoneIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanupCall = useCallback(() => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }
    originalVideoTrackRef.current = null;
    remoteStreamRef.current = null;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;
    recordedChunksRef.current = [];
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
    if (ringtoneIntervalRef.current) {
      clearInterval(ringtoneIntervalRef.current);
      ringtoneIntervalRef.current = null;
    }
    if (signalingChannelRef.current) {
      supabase.removeChannel(signalingChannelRef.current);
      signalingChannelRef.current = null;
    }
    setCallDuration(0);
    setIsMuted(false);
    setIsVideoEnabled(true);
    setIsScreenSharing(false);
    setIsPipMode(false);
    setIsRecording(false);
    setActiveCall(null);
    setIncomingCall(null);
  }, []);

  const setupPeerConnection = useCallback((callId: string, isVideo: boolean) => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    });

    pc.onicecandidate = (event) => {
      if (event.candidate && signalingChannelRef.current) {
        signalingChannelRef.current.send({
          type: "broadcast",
          event: "ice-candidate",
          payload: { candidate: event.candidate.toJSON(), userId: user?.id },
        });
      }
    };

    pc.ontrack = (event) => {
      remoteStreamRef.current = event.streams[0];
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
        endCall();
      }
    };

    peerConnectionRef.current = pc;
    return pc;
  }, [user?.id]);

  const setupSignaling = useCallback((callId: string) => {
    const channel = supabase.channel(`call:${callId}`);
    
    channel.on("broadcast", { event: "offer" }, async (payload) => {
      const pc = peerConnectionRef.current;
      if (!pc || payload.payload.userId === user?.id) return;
      await pc.setRemoteDescription(new RTCSessionDescription(payload.payload.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      channel.send({
        type: "broadcast",
        event: "answer",
        payload: { answer, userId: user?.id },
      });
    });

    channel.on("broadcast", { event: "answer" }, async (payload) => {
      const pc = peerConnectionRef.current;
      if (!pc || payload.payload.userId === user?.id) return;
      await pc.setRemoteDescription(new RTCSessionDescription(payload.payload.answer));
    });

    channel.on("broadcast", { event: "ice-candidate" }, async (payload) => {
      const pc = peerConnectionRef.current;
      if (!pc || payload.payload.userId === user?.id) return;
      try {
        await pc.addIceCandidate(new RTCIceCandidate(payload.payload.candidate));
      } catch (e) {
        console.error("Error adding ICE candidate:", e);
      }
    });

    channel.on("broadcast", { event: "call-ended" }, (payload) => {
      if (payload.payload.userId !== user?.id) {
        toast.info("Call ended");
        cleanupCall();
      }
    });

    channel.subscribe();
    signalingChannelRef.current = channel;
    return channel;
  }, [user?.id, cleanupCall]);

  const startCall = useCallback(async (conversationId: string, callType: "voice" | "video") => {
    if (!user || activeCall || incomingCall) return;

    try {
      const isVideo = callType === "video";
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: isVideo,
      });
      localStreamRef.current = stream;

      // Create call record
      const { data: call, error } = await supabase
        .from("calls")
        .insert({
          conversation_id: conversationId,
          caller_id: user.id,
          call_type: callType,
          status: "ringing",
        })
        .select()
        .single();

      if (error || !call) {
        toast.error("Failed to start call");
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      const pc = setupPeerConnection(call.id, isVideo);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      const channel = setupSignaling(call.id);

      // Get caller profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", user.id)
        .single();

      setActiveCall({
        callId: call.id,
        conversationId,
        callerId: user.id,
        callerName: profile?.display_name || "You",
        callType,
        status: "ringing",
        isOutgoing: true,
      });

      // Create and send offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      channel.send({
        type: "broadcast",
        event: "offer",
        payload: { offer, userId: user.id },
      });

      // Play ringtone
      ringtoneIntervalRef.current = setInterval(() => {
        playNotificationSound();
      }, 3000);
      playNotificationSound();

      // Auto-miss after 30s
      setTimeout(() => {
        if (activeCall?.status === "ringing") {
          missCall(call.id);
        }
      }, 30000);

    } catch (err) {
      console.error("Failed to start call:", err);
      toast.error("Could not access camera/microphone");
    }
  }, [user, activeCall, incomingCall, setupPeerConnection, setupSignaling]);

  const answerCall = useCallback(async () => {
    if (!incomingCall || !user) return;

    try {
      const isVideo = incomingCall.callType === "video";
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: isVideo,
      });
      localStreamRef.current = stream;

      const pc = setupPeerConnection(incomingCall.callId, isVideo);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      setupSignaling(incomingCall.callId);

      // Update call status
      await supabase
        .from("calls")
        .update({ status: "active", started_at: new Date().toISOString() })
        .eq("id", incomingCall.callId);

      setActiveCall({ ...incomingCall, status: "active", isOutgoing: false });
      setIncomingCall(null);

      // Start duration timer
      durationTimerRef.current = setInterval(() => {
        setCallDuration((d) => d + 1);
      }, 1000);

      if (ringtoneIntervalRef.current) {
        clearInterval(ringtoneIntervalRef.current);
        ringtoneIntervalRef.current = null;
      }
    } catch (err) {
      console.error("Failed to answer call:", err);
      toast.error("Could not access camera/microphone");
    }
  }, [incomingCall, user, setupPeerConnection, setupSignaling]);

  const declineCall = useCallback(async () => {
    if (!incomingCall) return;
    await supabase
      .from("calls")
      .update({ status: "declined", ended_at: new Date().toISOString() })
      .eq("id", incomingCall.callId);

    if (signalingChannelRef.current) {
      signalingChannelRef.current.send({
        type: "broadcast",
        event: "call-ended",
        payload: { userId: user?.id },
      });
    }
    cleanupCall();
  }, [incomingCall, user?.id, cleanupCall]);

  const saveRecording = useCallback(async (callId: string) => {
    if (recordedChunksRef.current.length === 0) return;
    const isVideo = activeCall?.callType === "video";
    const mimeType = isVideo ? "video/webm" : "audio/webm";
    const ext = isVideo ? "webm" : "webm";
    const blob = new Blob(recordedChunksRef.current, { type: mimeType });
    const filePath = `${user?.id}/${callId}.${ext}`;
    
    const { error: uploadError } = await supabase.storage
      .from("call-recordings")
      .upload(filePath, blob, { contentType: mimeType, upsert: true });

    if (uploadError) {
      console.error("Failed to upload recording:", uploadError);
      toast.error("Failed to save recording");
      return;
    }

    const { data: urlData } = supabase.storage
      .from("call-recordings")
      .getPublicUrl(filePath);

    await supabase
      .from("calls")
      .update({ recording_url: urlData.publicUrl })
      .eq("id", callId);

    toast.success("Call recording saved");
  }, [user?.id, activeCall?.callType]);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      // Stop recording
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
      toast.info("Recording stopped");
    } else {
      // Start recording - combine local and remote streams
      try {
        const audioCtx = new AudioContext();
        const dest = audioCtx.createMediaStreamDestination();

        if (localStreamRef.current) {
          localStreamRef.current.getAudioTracks().forEach((track) => {
            const source = audioCtx.createMediaStreamSource(new MediaStream([track]));
            source.connect(dest);
          });
        }
        if (remoteStreamRef.current) {
          remoteStreamRef.current.getAudioTracks().forEach((track) => {
            const source = audioCtx.createMediaStreamSource(new MediaStream([track]));
            source.connect(dest);
          });
        }

        // For video calls, include video track from remote
        const tracks = [...dest.stream.getTracks()];
        if (activeCall?.callType === "video" && remoteStreamRef.current) {
          const videoTrack = remoteStreamRef.current.getVideoTracks()[0];
          if (videoTrack) tracks.push(videoTrack);
        }

        const combinedStream = new MediaStream(tracks);
        const mimeType = activeCall?.callType === "video" ? "video/webm;codecs=vp8,opus" : "audio/webm;codecs=opus";
        const recorder = new MediaRecorder(combinedStream, {
          mimeType: MediaRecorder.isTypeSupported(mimeType) ? mimeType : undefined,
        });

        recordedChunksRef.current = [];
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) recordedChunksRef.current.push(e.data);
        };

        recorder.start(1000);
        mediaRecorderRef.current = recorder;
        setIsRecording(true);
        toast.success("Recording started");
      } catch (err) {
        console.error("Failed to start recording:", err);
        toast.error("Could not start recording");
      }
    }
  }, [isRecording, activeCall?.callType]);

  const endCall = useCallback(async () => {
    const call = activeCall || incomingCall;
    if (!call) return;

    // Save recording if active
    if (isRecording && recordedChunksRef.current.length > 0) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      // Wait a tick for final data
      await new Promise((r) => setTimeout(r, 200));
      await saveRecording(call.callId);
    }

    await supabase
      .from("calls")
      .update({ status: "ended", ended_at: new Date().toISOString() })
      .eq("id", call.callId);

    if (signalingChannelRef.current) {
      signalingChannelRef.current.send({
        type: "broadcast",
        event: "call-ended",
        payload: { userId: user?.id },
      });
    }
    cleanupCall();
  }, [activeCall, incomingCall, user?.id, cleanupCall, isRecording, saveRecording]);

  const missCall = useCallback(async (callId: string) => {
    await supabase
      .from("calls")
      .update({ status: "missed", ended_at: new Date().toISOString() })
      .eq("id", callId);
    cleanupCall();
    toast.info("Call was not answered");
  }, [cleanupCall]);

  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  }, []);

  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  }, []);

  const toggleSpeaker = useCallback(() => {
    setIsSpeaker((s) => !s);
  }, []);

  const toggleScreenShare = useCallback(async () => {
    const pc = peerConnectionRef.current;
    if (!pc) return;

    if (isScreenSharing) {
      // Stop screen sharing, restore camera
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = null;
      }
      if (originalVideoTrackRef.current) {
        const sender = pc.getSenders().find((s) => s.track?.kind === "video");
        if (sender) {
          await sender.replaceTrack(originalVideoTrackRef.current);
        }
        // Update local stream for PiP display
        if (localStreamRef.current) {
          const oldVideoTrack = localStreamRef.current.getVideoTracks()[0];
          if (oldVideoTrack) localStreamRef.current.removeTrack(oldVideoTrack);
          localStreamRef.current.addTrack(originalVideoTrackRef.current);
        }
        originalVideoTrackRef.current = null;
      }
      setIsScreenSharing(false);
      toast.info("Screen sharing stopped");
    } else {
      // Start screen sharing
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = screenStream;

        const screenTrack = screenStream.getVideoTracks()[0];
        const sender = pc.getSenders().find((s) => s.track?.kind === "video");

        if (sender) {
          // Save original camera track
          originalVideoTrackRef.current = sender.track;
          await sender.replaceTrack(screenTrack);

          // Update local stream for PiP display
          if (localStreamRef.current) {
            const oldVideoTrack = localStreamRef.current.getVideoTracks()[0];
            if (oldVideoTrack) localStreamRef.current.removeTrack(oldVideoTrack);
            localStreamRef.current.addTrack(screenTrack);
          }
        }

        // Auto-stop when user clicks "Stop sharing" in browser UI
        screenTrack.onended = () => {
          toggleScreenShare();
        };

        setIsScreenSharing(true);
        toast.success("Screen sharing started");
      } catch (err) {
        console.error("Screen share error:", err);
        // User cancelled the picker - no error toast needed
      }
    }
  }, [isScreenSharing]);

  // Listen for incoming calls
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("incoming-calls")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "calls",
        },
        async (payload) => {
          const call = payload.new as any;
          if (call.caller_id === user.id || call.status !== "ringing") return;

          // Check if user is a member of the conversation
          const { data: membership } = await supabase
            .from("conversation_members")
            .select("id")
            .eq("conversation_id", call.conversation_id)
            .eq("user_id", user.id)
            .maybeSingle();

          if (!membership) return;

          // Get caller profile
          const { data: profile } = await supabase
            .from("profiles")
            .select("display_name")
            .eq("user_id", call.caller_id)
            .single();

          playNotificationSound();
          ringtoneIntervalRef.current = setInterval(() => {
            playNotificationSound();
          }, 3000);

          setIncomingCall({
            callId: call.id,
            conversationId: call.conversation_id,
            callerId: call.caller_id,
            callerName: profile?.display_name || "Unknown",
            callType: call.call_type,
            status: "ringing",
            isOutgoing: false,
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "calls",
        },
        (payload) => {
          const call = payload.new as any;
          // If outgoing call is answered
          if (activeCall?.callId === call.id && call.status === "active" && activeCall.isOutgoing) {
            setActiveCall((prev) => prev ? { ...prev, status: "active" } : null);
            if (ringtoneIntervalRef.current) {
              clearInterval(ringtoneIntervalRef.current);
              ringtoneIntervalRef.current = null;
            }
            durationTimerRef.current = setInterval(() => {
              setCallDuration((d) => d + 1);
            }, 1000);
          }
          // If call ended/declined/missed by other
          if (
            (call.status === "ended" || call.status === "declined" || call.status === "missed") &&
            (activeCall?.callId === call.id || incomingCall?.callId === call.id)
          ) {
            if (call.status === "declined") toast.info("Call was declined");
            if (call.status === "missed") toast.info("No answer");
            cleanupCall();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, activeCall, incomingCall, cleanupCall]);

  const formatCallDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return {
    activeCall,
    incomingCall,
    callDuration,
    formatCallDuration,
    isMuted,
    isVideoEnabled,
    isSpeaker,
    isScreenSharing,
    isPipMode,
    setIsPipMode,
    isRecording,
    startCall,
    answerCall,
    declineCall,
    endCall,
    toggleMute,
    toggleVideo,
    toggleSpeaker,
    toggleScreenShare,
    toggleRecording,
    localVideoRef,
    remoteVideoRef,
    localStreamRef,
    remoteStreamRef,
  };
}
