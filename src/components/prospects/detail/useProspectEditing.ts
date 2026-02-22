import { useState } from 'react';
import { toast } from 'sonner';
import type { Prospect } from '@/api/prospects';

export function useProspectEditing(
  prospect: Prospect,
  onUpdateProspect?: (updates: Partial<Prospect>) => Promise<boolean>
) {
  // Revenue editing state
  const [isEditingRevenue, setIsEditingRevenue] = useState(false);
  const [editedRevenue, setEditedRevenue] = useState('');
  const [isSavingRevenue, setIsSavingRevenue] = useState(false);

  // Industry editing state
  const [isEditingIndustry, setIsEditingIndustry] = useState(false);
  const [editedIndustry, setEditedIndustry] = useState('');
  const [isSavingIndustry, setIsSavingIndustry] = useState(false);

  // Website editing state
  const [isEditingWebsite, setIsEditingWebsite] = useState(false);
  const [editedWebsite, setEditedWebsite] = useState('');
  const [isSavingWebsite, setIsSavingWebsite] = useState(false);

  // Salesforce link editing state
  const [isEditingSalesforce, setIsEditingSalesforce] = useState(false);
  const [editedSalesforce, setEditedSalesforce] = useState('');
  const [isSavingSalesforce, setIsSavingSalesforce] = useState(false);

  // Opportunity link editing state
  const [isEditingOpportunity, setIsEditingOpportunity] = useState(false);
  const [editedOpportunity, setEditedOpportunity] = useState('');
  const [isSavingOpportunity, setIsSavingOpportunity] = useState(false);

  // Account name editing state
  const [isEditingAccountName, setIsEditingAccountName] = useState(false);
  const [editedAccountName, setEditedAccountName] = useState('');
  const [isSavingAccountName, setIsSavingAccountName] = useState(false);

  // Revenue handlers
  const handleStartEditRevenue = () => {
    setEditedRevenue(prospect.active_revenue?.toString() || '0');
    setIsEditingRevenue(true);
  };

  const handleSaveRevenue = async () => {
    if (!onUpdateProspect) return;
    const newRevenue = parseFloat(editedRevenue) || 0;
    if (newRevenue < 0) {
      toast.error('Revenue cannot be negative');
      return;
    }
    setIsSavingRevenue(true);
    try {
      const success = await onUpdateProspect({ active_revenue: newRevenue });
      if (success) {
        setIsEditingRevenue(false);
        toast.success('Opportunity updated');
      }
    } finally {
      setIsSavingRevenue(false);
    }
  };

  // Industry handlers
  const handleSaveIndustry = async () => {
    if (!onUpdateProspect) return;
    setIsSavingIndustry(true);
    try {
      const success = await onUpdateProspect({ industry: editedIndustry || null });
      if (success) {
        setIsEditingIndustry(false);
        toast.success('Industry updated');
      }
    } finally {
      setIsSavingIndustry(false);
    }
  };

  // Website handlers
  const handleSaveWebsite = async () => {
    if (!onUpdateProspect) return;
    setIsSavingWebsite(true);
    try {
      const success = await onUpdateProspect({ website: editedWebsite || null });
      if (success) {
        setIsEditingWebsite(false);
        toast.success('Website updated');
      }
    } finally {
      setIsSavingWebsite(false);
    }
  };

  // Salesforce handlers
  const handleSaveSalesforce = async () => {
    if (!onUpdateProspect) return;
    setIsSavingSalesforce(true);
    try {
      const success = await onUpdateProspect({ salesforce_link: editedSalesforce || null });
      if (success) {
        setIsEditingSalesforce(false);
        toast.success('Salesforce link updated');
      }
    } finally {
      setIsSavingSalesforce(false);
    }
  };

  // Opportunity link handlers
  const handleSaveOpportunity = async () => {
    if (!onUpdateProspect) return;
    setIsSavingOpportunity(true);
    try {
      const success = await onUpdateProspect({ opportunity_link: editedOpportunity || null });
      if (success) {
        setIsEditingOpportunity(false);
        toast.success('Opportunity link updated');
      }
    } finally {
      setIsSavingOpportunity(false);
    }
  };

  // Account name handlers
  const handleStartEditAccountName = () => {
    setEditedAccountName(prospect.account_name || prospect.prospect_name || '');
    setIsEditingAccountName(true);
  };

  const handleSaveAccountName = async () => {
    if (!onUpdateProspect) return;
    const trimmed = editedAccountName.trim();
    if (!trimmed) {
      toast.error('Account name cannot be empty');
      return;
    }
    setIsSavingAccountName(true);
    try {
      const success = await onUpdateProspect({ account_name: trimmed });
      if (success) {
        setIsEditingAccountName(false);
        toast.success('Account name updated');
      }
    } finally {
      setIsSavingAccountName(false);
    }
  };

  return {
    revenue: {
      isEditing: isEditingRevenue,
      edited: editedRevenue,
      isSaving: isSavingRevenue,
      setEdited: setEditedRevenue,
      startEdit: handleStartEditRevenue,
      save: handleSaveRevenue,
      cancel: () => setIsEditingRevenue(false),
    },
    industry: {
      isEditing: isEditingIndustry,
      edited: editedIndustry,
      isSaving: isSavingIndustry,
      setEdited: setEditedIndustry,
      startEdit: () => { setEditedIndustry(prospect.industry || ''); setIsEditingIndustry(true); },
      save: handleSaveIndustry,
      cancel: () => setIsEditingIndustry(false),
    },
    website: {
      isEditing: isEditingWebsite,
      edited: editedWebsite,
      isSaving: isSavingWebsite,
      setEdited: setEditedWebsite,
      startEdit: () => { setEditedWebsite(prospect.website || ''); setIsEditingWebsite(true); },
      save: handleSaveWebsite,
      cancel: () => setIsEditingWebsite(false),
    },
    salesforce: {
      isEditing: isEditingSalesforce,
      edited: editedSalesforce,
      isSaving: isSavingSalesforce,
      setEdited: setEditedSalesforce,
      startEdit: () => { setEditedSalesforce(prospect.salesforce_link || ''); setIsEditingSalesforce(true); },
      save: handleSaveSalesforce,
      cancel: () => setIsEditingSalesforce(false),
    },
    opportunity: {
      isEditing: isEditingOpportunity,
      edited: editedOpportunity,
      isSaving: isSavingOpportunity,
      setEdited: setEditedOpportunity,
      startEdit: () => { setEditedOpportunity(prospect.opportunity_link || ''); setIsEditingOpportunity(true); },
      save: handleSaveOpportunity,
      cancel: () => setIsEditingOpportunity(false),
    },
    accountName: {
      isEditing: isEditingAccountName,
      edited: editedAccountName,
      isSaving: isSavingAccountName,
      setEdited: setEditedAccountName,
      startEdit: handleStartEditAccountName,
      save: handleSaveAccountName,
      cancel: () => setIsEditingAccountName(false),
    },
  };
}
