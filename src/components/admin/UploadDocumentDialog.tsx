import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, FileText, X } from 'lucide-react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { uploadProductDocument } from '@/api/productKnowledge';

interface UploadDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PAGE_TYPES = [
  { value: 'product', label: 'Product' },
  { value: 'feature', label: 'Feature' },
  { value: 'pricing', label: 'Pricing' },
  { value: 'documentation', label: 'Documentation' },
  { value: 'faq', label: 'FAQ' },
  { value: 'training', label: 'Training Material' },
  { value: 'case_study', label: 'Case Study' },
  { value: 'other', label: 'Other' },
];

const SUPPORTED_EXTENSIONS = ['pdf', 'docx', 'txt', 'md'];

export function UploadDocumentDialog({ open, onOpenChange }: UploadDocumentDialogProps) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [pageType, setPageType] = useState('documentation');
  const [isDragOver, setIsDragOver] = useState(false);

  const uploadMutation = useMutation({
    mutationFn: () => {
      if (!file) throw new Error('No file selected');
      return uploadProductDocument(file, { title: title || file.name, pageType });
    },
    onSuccess: (result) => {
      if (result.success) {
        toast.success(result.message || 'Document uploaded successfully');
        queryClient.invalidateQueries({ queryKey: ['product-knowledge-stats'] });
        queryClient.invalidateQueries({ queryKey: ['product-knowledge-pages'] });
        handleClose();
      } else {
        toast.error(result.error || 'Upload failed');
      }
    },
    onError: (error) => {
      toast.error(`Upload failed: ${error.message}`);
    },
  });

  const handleClose = () => {
    setFile(null);
    setTitle('');
    setPageType('documentation');
    onOpenChange(false);
  };

  const validateFile = (f: File): boolean => {
    const ext = f.name.split('.').pop()?.toLowerCase();
    if (!ext || !SUPPORTED_EXTENSIONS.includes(ext)) {
      toast.error(`Unsupported file type. Supported: ${SUPPORTED_EXTENSIONS.join(', ')}`);
      return false;
    }
    // 10MB limit
    if (f.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return false;
    }
    return true;
  };

  const handleFileSelect = (f: File) => {
    if (validateFile(f)) {
      setFile(f);
      // Auto-fill title from filename
      const nameWithoutExt = f.name.replace(/\.[^.]+$/, '');
      setTitle(nameWithoutExt);
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFileSelect(selectedFile);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Upload Document</DialogTitle>
          <DialogDescription>
            Upload a document to add to the product knowledge base. Supported formats: PDF, DOCX, TXT, MD.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`
              relative border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer
              ${isDragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}
              ${file ? 'bg-muted/50' : ''}
            `}
          >
            <input
              type="file"
              accept=".pdf,.docx,.txt,.md"
              onChange={handleInputChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            
            {file ? (
              <div className="flex items-center justify-center gap-3">
                <FileText className="h-8 w-8 text-primary" />
                <div className="text-left">
                  <p className="font-medium truncate max-w-[250px]">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                    setTitle('');
                  }}
                  className="ml-2"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Drop file here or click to browse
                </p>
                <p className="text-xs text-muted-foreground">
                  PDF, DOCX, TXT, MD (max 10MB)
                </p>
              </div>
            )}
          </div>

          {/* Title Input */}
          <div className="space-y-2">
            <Label htmlFor="doc-title">Document Title</Label>
            <Input
              id="doc-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter a descriptive title"
            />
          </div>

          {/* Page Type Select */}
          <div className="space-y-2">
            <Label htmlFor="page-type">Document Type</Label>
            <Select value={pageType} onValueChange={setPageType}>
              <SelectTrigger id="page-type">
                <SelectValue placeholder="Select document type" />
              </SelectTrigger>
              <SelectContent>
                {PAGE_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={() => uploadMutation.mutate()}
            disabled={!file || uploadMutation.isPending}
          >
            {uploadMutation.isPending ? (
              <>
                <Upload className="h-4 w-4 mr-2 animate-pulse" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload Document
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
