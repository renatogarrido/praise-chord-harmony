import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, Upload, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ProfileImageUploadProps {
  userId: string;
  currentImageUrl?: string;
  onImageUploaded: (url: string) => void;
  name?: string;
}

export function ProfileImageUpload({ userId, currentImageUrl, onImageUploaded, name }: ProfileImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFile = async (file: File) => {
    try {
      setIsUploading(true);

      const fileExt = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

      console.log("[ProfileImage] Uploading to:", fileName, "size:", file.size);

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type || 'image/jpeg',
        });

      if (uploadError) {
        console.error("[ProfileImage] Upload error:", uploadError);
        throw uploadError;
      }

      const { data: signedData, error: signError } = await supabase.storage
        .from('avatars')
        .createSignedUrl(fileName, 31536000); // 1 ano de validade

      if (signError) {
        console.error("[ProfileImage] Error signing URL:", signError);
        throw signError;
      }

      const signedUrl = signedData.signedUrl;
      console.log("[ProfileImage] Signed URL generated:", signedUrl);

      setPreviewUrl(signedUrl);
      onImageUploaded(signedUrl);
      toast.success("Foto atualizada!");
    } catch (error: any) {
      console.error("Error uploading image:", error);
      toast.error("Erro ao fazer upload: " + (error?.message || "desconhecido"));
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) return;
    uploadFile(event.target.files[0]);
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: "user"
        } 
      });
      setCameraStream(stream);
      setShowCamera(true);
      
      // Use a timeout to ensure the video element is rendered
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play().catch(err => console.error("Video play error:", err));
          };
        }
      }, 100);
    } catch (err) {
      console.error("Error accessing camera:", err);
      toast.error("Não foi possível acessar a câmera.");
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;

    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    
    canvas.toBlob(async (blob) => {
      if (blob) {
        const file = new File([blob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" });
        await uploadFile(file);
        stopCamera();
      }
    }, "image/jpeg", 0.8);
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative group">
        <Avatar key={previewUrl || currentImageUrl || 'empty'} className="h-24 w-24 border-2 border-gold/20">
          <AvatarImage src={previewUrl || currentImageUrl || undefined} className="object-cover" />
          <AvatarFallback className="bg-gold-soft text-gold text-2xl font-serif">
            {name ? name[0].toUpperCase() : "?"}
          </AvatarFallback>
        </Avatar>
        
        {isUploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full">
            <Loader2 className="h-8 w-8 animate-spin text-white" />
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Button 
          type="button" 
          variant="outline" 
          size="sm" 
          className="gap-2"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          <Upload className="h-4 w-4" />
          Upload
        </Button>
        <Button 
          type="button" 
          variant="outline" 
          size="sm" 
          className="gap-2"
          onClick={startCamera}
          disabled={isUploading}
        >
          <Camera className="h-4 w-4" />
          Tirar Foto
        </Button>
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept="image/*" 
          onChange={handleFileChange} 
        />
      </div>

      <Dialog 
        open={showCamera} 
        onOpenChange={(open) => {
          if (!open) stopCamera();
        }}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Tirar Foto</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="relative aspect-square w-full max-w-[300px] overflow-hidden rounded-2xl bg-black">
              <video 
                ref={videoRef} 
                autoPlay 
                muted
                playsInline 
                className="h-full w-full object-cover -scale-x-100"
              />
            </div>
            <div className="flex gap-3 w-full">
              <Button 
                type="button" 
                variant="outline" 
                className="flex-1" 
                onClick={stopCamera}
              >
                Cancelar
              </Button>
              <Button 
                type="button" 
                className="flex-1 bg-gold text-white hover:bg-gold/90" 
                onClick={capturePhoto}
              >
                Capturar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
