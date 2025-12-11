import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchCustomPresets, deleteCustomPreset, type CustomPreset } from '@/api/customPresets';
import { getAnalysisModeById, getPresetById, type ModePreset } from '../transcript-analysis/analysisModesConfig';
import { toast } from 'sonner';

export function useModePresets() {
  const [selectedModeId, setSelectedModeId] = useState('general');
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [createPresetOpen, setCreatePresetOpen] = useState(false);
  const [editingPreset, setEditingPreset] = useState<CustomPreset | null>(null);
  const [deletePresetId, setDeletePresetId] = useState<string | null>(null);
  
  // Mode switch confirmation state
  const [pendingModeChange, setPendingModeChange] = useState<{
    type: 'mode' | 'preset' | 'custom';
    id: string;
    prompt?: string;
  } | null>(null);
  const [showModeChangeConfirm, setShowModeChangeConfirm] = useState(false);

  const queryClient = useQueryClient();

  // Fetch custom presets
  const { data: customPresets = [], isLoading: isLoadingPresets } = useQuery({
    queryKey: ['customPresets'],
    queryFn: fetchCustomPresets,
  });

  const selectedMode = getAnalysisModeById(selectedModeId);
  const activePreset = activePresetId ? getPresetById(activePresetId) : null;

  const handleModeChange = (newModeId: string, hasMessages: boolean) => {
    if (hasMessages) {
      setPendingModeChange({ type: 'mode', id: newModeId });
      setShowModeChangeConfirm(true);
    } else {
      setSelectedModeId(newModeId);
      setActivePresetId(null);
    }
  };

  const handlePresetSelect = (preset: ModePreset, hasMessages: boolean, executePreset: (preset: ModePreset) => void) => {
    if (hasMessages) {
      setPendingModeChange({ type: 'preset', id: preset.id, prompt: preset.starterPrompt });
      setShowModeChangeConfirm(true);
    } else {
      executePreset(preset);
    }
  };

  const handleCustomPresetSelect = (preset: CustomPreset, hasMessages: boolean, executeCustomPreset: (preset: CustomPreset) => void) => {
    if (hasMessages) {
      setPendingModeChange({ type: 'custom', id: preset.id, prompt: preset.starter_prompt });
      setShowModeChangeConfirm(true);
    } else {
      executeCustomPreset(preset);
    }
  };

  const confirmModeChange = (executePreset: (preset: ModePreset) => void, executeCustomPreset: (preset: CustomPreset) => void) => {
    if (!pendingModeChange) return;
    
    if (pendingModeChange.type === 'mode') {
      setSelectedModeId(pendingModeChange.id);
      setActivePresetId(null);
      toast.success('Mode changed', {
        description: 'Chat history preserved. New questions will use the selected mode.',
      });
    } else if (pendingModeChange.type === 'preset') {
      const preset = getPresetById(pendingModeChange.id);
      if (preset) {
        executePreset(preset);
      }
    } else if (pendingModeChange.type === 'custom') {
      const preset = customPresets.find(p => p.id === pendingModeChange.id);
      if (preset) {
        executeCustomPreset(preset);
      }
    }
    
    setPendingModeChange(null);
    setShowModeChangeConfirm(false);
  };

  const handleDeletePreset = async () => {
    if (!deletePresetId) return;
    
    try {
      await deleteCustomPreset(deletePresetId);
      queryClient.invalidateQueries({ queryKey: ['customPresets'] });
      toast.success('Preset deleted', {
        description: 'The custom preset has been removed.',
      });
    } catch (error) {
      toast.error('Error', {
        description: 'Failed to delete preset',
      });
    } finally {
      setDeletePresetId(null);
    }
  };

  const pendingLabel = pendingModeChange?.type === 'mode' 
    ? getAnalysisModeById(pendingModeChange.id)?.label 
    : pendingModeChange?.type === 'preset'
    ? getPresetById(pendingModeChange.id)?.label
    : customPresets.find(p => p.id === pendingModeChange?.id)?.name;

  return {
    selectedModeId,
    setSelectedModeId,
    activePresetId,
    setActivePresetId,
    selectedMode,
    activePreset,
    customPresets,
    isLoadingPresets,
    createPresetOpen,
    setCreatePresetOpen,
    editingPreset,
    setEditingPreset,
    deletePresetId,
    setDeletePresetId,
    pendingModeChange,
    showModeChangeConfirm,
    setShowModeChangeConfirm,
    pendingLabel,
    handleModeChange,
    handlePresetSelect,
    handleCustomPresetSelect,
    confirmModeChange,
    handleDeletePreset,
  };
}
