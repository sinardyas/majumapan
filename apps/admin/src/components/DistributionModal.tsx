import { useState, useEffect, useCallback } from 'react';
import { Button, Input, Select } from '@pos/ui';
import { Plus, Trash2, Edit, Send, Eye, Users, MessageSquare, Mail, Printer, X, Gift } from 'lucide-react';
import { distributionApi, type MessageTemplate, type DistributionHistory, type DistributeInput, type DistributionResult } from '@/services/distribution';
import { customerApi, type CustomerGroup } from '@/services/customer';
import { type Voucher } from '@/services/voucher';
import { useToast } from '@pos/ui';

interface TemplateFormData {
  name: string;
  subject: string;
  message: string;
  isDefault: boolean;
}

interface DistributionModalProps {
  voucher: Voucher | null;
  isOpen: boolean;
  onClose: () => void;
}

export function DistributionModal({ voucher, isOpen, onClose }: DistributionModalProps) {
  const { success, error: showError } = useToast();
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [groups, setGroups] = useState<CustomerGroup[]>([]);
  const [history, setHistory] = useState<DistributionHistory[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [formData, setFormData] = useState<TemplateFormData>({
    name: '',
    subject: '',
    message: '',
    isDefault: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<MessageTemplate | null>(null);

  const [recipientType, setRecipientType] = useState<'all' | 'group' | 'individual' | 'manual'>('all');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [individualPhone, setIndividualPhone] = useState('');
  const [manualPhones, setManualPhones] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [previewMessage, setPreviewMessage] = useState('');
  const [isDistributing, setIsDistributing] = useState(false);
  const [distributionResult, setDistributionResult] = useState<DistributionResult | null>(null);
  const [activeTab, setActiveTab] = useState<'distribute' | 'history'>('distribute');

  const loadData = useCallback(async () => {
    try {
      const [templatesRes, groupsRes, historyRes] = await Promise.all([
        distributionApi.getTemplates(),
        customerApi.getGroups(),
        distributionApi.getHistory(20),
      ]);

      if (templatesRes.success && templatesRes.data) {
        setTemplates(templatesRes.data);
        const defaultTemplate = templatesRes.data.find(t => t.isDefault);
        if (defaultTemplate) {
          setSelectedTemplate(defaultTemplate.id);
        }
      }
      if (groupsRes.success && groupsRes.data) {
        setGroups(groupsRes.data);
      }
      if (historyRes.success && historyRes.data) {
        setHistory(historyRes.data);
      }
    } catch (err) {
      console.error('Error loading data:', err);
      showError('Failed to load data');
    }
  }, [showError]);

  useEffect(() => {
    if (isOpen) {
      loadData();
      setDistributionResult(null);
      setPreviewMessage('');
    }
  }, [isOpen, loadData]);

  const handleSubmitTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      let response;
      if (editingTemplate) {
        response = await distributionApi.updateTemplate(editingTemplate.id, {
          name: formData.name || undefined,
          subject: formData.subject || undefined,
          message: formData.message,
          isDefault: formData.isDefault || undefined,
        });
      } else {
        response = await distributionApi.createTemplate({
          name: formData.name,
          subject: formData.subject || undefined,
          message: formData.message,
          isDefault: formData.isDefault,
        });
      }

      if (response.success) {
        success(editingTemplate ? 'Template updated' : 'Template created');
        closeForm();
        loadData();
      } else {
        showError(response.error || 'Failed to save template');
      }
    } catch (err) {
      console.error('Error saving template:', err);
      showError('Failed to save template');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTemplate = async () => {
    if (!templateToDelete) return;

    try {
      const response = await distributionApi.deleteTemplate(templateToDelete.id);
      if (response.success) {
        success('Template deleted');
        setShowDeleteConfirm(false);
        setTemplateToDelete(null);
        loadData();
      } else {
        showError(response.error || 'Failed to delete template');
      }
    } catch (err) {
      console.error('Error deleting template:', err);
      showError('Failed to delete template');
    }
  };

  const openEditForm = (template: MessageTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      subject: template.subject || '',
      message: template.message,
      isDefault: template.isDefault,
    });
    setIsFormOpen(true);
  };

  const openCreateForm = () => {
    setEditingTemplate(null);
    setFormData({ name: '', subject: '', message: '', isDefault: false });
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingTemplate(null);
    setFormData({ name: '', subject: '', message: '', isDefault: false });
  };

  const handlePreview = async () => {
    if (!voucher || !selectedTemplate) {
      showError('Please select a template');
      return;
    }

    try {
      const response = await distributionApi.preview({
        templateId: selectedTemplate,
        voucherCode: voucher.code,
        customerName: 'John Doe',
      });

      if (response.success && response.data) {
        setPreviewMessage(response.data.preview);
      } else {
        showError(response.error || 'Failed to generate preview');
      }
    } catch (err) {
      console.error('Error generating preview:', err);
      showError('Failed to generate preview');
    }
  };

  const handleDistribute = async () => {
    if (!voucher) {
      showError('No voucher selected');
      return;
    }

    setIsDistributing(true);
    setDistributionResult(null);

    try {
      const input: DistributeInput = {
        voucherCode: voucher.code,
        channel: 'whatsapp',
        recipientType,
        templateId: selectedTemplate || undefined,
      };

      if (recipientType === 'group' && selectedGroup) {
        input.groupId = selectedGroup;
      } else if (recipientType === 'individual' && individualPhone) {
        input.individualPhone = individualPhone;
      } else if (recipientType === 'manual' && manualPhones) {
        input.manualPhones = manualPhones.split(',').map(p => p.trim()).filter(Boolean);
      }

      const response = await distributionApi.distribute(input);

      if (response.success && response.data) {
        setDistributionResult(response.data);
        success(`Prepared distribution to ${response.data.recipientCount} recipients`);
        loadData();
      } else {
        showError(response.error || 'Failed to distribute');
      }
    } catch (err) {
      console.error('Error distributing:', err);
      showError('Failed to distribute');
    } finally {
      setIsDistributing(false);
    }
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'whatsapp': return <MessageSquare className="h-4 w-4 text-green-600" />;
      case 'email': return <Mail className="h-4 w-4 text-blue-600" />;
      case 'print': return <Printer className="h-4 w-4 text-gray-600" />;
      default: return null;
    }
  };

  const formatVoucherValue = (v: Voucher) => {
    if (v.type === 'GC') {
      return `Rp ${(v.currentBalance || 0).toLocaleString('id-ID')}`;
    }
    if (v.discountType === 'PERCENTAGE') {
      return `${v.percentageValue}% off`;
    }
    if (v.discountType === 'FIXED') {
      return `Rp ${(v.fixedValue || 0).toLocaleString('id-ID')}`;
    }
    return 'Free Item';
  };

  if (!isOpen || !voucher) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Send className="h-5 w-5 text-primary-600" />
            <div>
              <h3 className="text-lg font-semibold">Distribute Voucher</h3>
              <p className="text-sm text-gray-500">
                {voucher.code} • {formatVoucherValue(voucher)}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="border-b border-gray-200">
          <div className="flex px-6">
            <button
              onClick={() => setActiveTab('distribute')}
              className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'distribute'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Distribute
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'history'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              History
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'distribute' ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                    <Gift className="h-4 w-4" />
                    Recipients
                  </h4>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Recipients
                      </label>
                      <Select
                        value={recipientType}
                        onChange={(e) => setRecipientType(e.target.value as typeof recipientType)}
                      >
                        <option value="all">All Customers</option>
                        <option value="group">Customer Group</option>
                        <option value="individual">Individual Phone</option>
                        <option value="manual">Manual Phone List</option>
                      </Select>
                    </div>

                    {recipientType === 'group' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Select Group
                        </label>
                        <Select
                          value={selectedGroup}
                          onChange={(e) => setSelectedGroup(e.target.value)}
                        >
                          <option value="">Choose a group...</option>
                          {groups.map((group) => (
                            <option key={group.id} value={group.id}>
                              {group.name} (Priority {group.priority})
                            </option>
                          ))}
                        </Select>
                      </div>
                    )}

                    {recipientType === 'individual' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Phone Number
                        </label>
                        <Input
                          type="text"
                          value={individualPhone}
                          onChange={(e) => setIndividualPhone(e.target.value)}
                          placeholder="08xx xxxx xxxx"
                        />
                      </div>
                    )}

                    {recipientType === 'manual' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Phone Numbers (comma-separated)
                        </label>
                        <Input
                          type="text"
                          value={manualPhones}
                          onChange={(e) => setManualPhones(e.target.value)}
                          placeholder="081234567890, 089876543210"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Message Template
                      </label>
                      <Select
                        value={selectedTemplate}
                        onChange={(e) => setSelectedTemplate(e.target.value)}
                      >
                        <option value="">Choose a template...</option>
                        {templates.map((template) => (
                          <option key={template.id} value={template.id}>
                            {template.name} {template.isDefault ? '(Default)' : ''}
                          </option>
                        ))}
                      </Select>
                    </div>

                    <div className="flex gap-3 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handlePreview}
                        disabled={!selectedTemplate}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Preview
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleDistribute}
                        isLoading={isDistributing}
                      >
                        <Send className="h-4 w-4 mr-2" />
                        Generate Links
                      </Button>
                    </div>
                  </div>

                  {previewMessage && (
                    <div className="mt-4 p-4 bg-white rounded-lg border border-gray-200">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Preview:</h4>
                      <p className="text-sm text-gray-600 whitespace-pre-wrap">{previewMessage}</p>
                    </div>
                  )}

                  {distributionResult && (
                    <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
                      <h4 className="text-sm font-medium text-green-800 mb-2">
                        Distribution Ready ({distributionResult.recipientCount} recipients)
                      </h4>
                      <div className="max-h-48 overflow-y-auto space-y-2">
                        {distributionResult.links.slice(0, 20).map((link, index) => (
                          <div
                            key={index}
                            className="flex items-center gap-2 text-xs bg-white p-2 rounded border border-green-100"
                          >
                            {getChannelIcon(link.channel)}
                            <span className="flex-1 truncate">{link.recipient}</span>
                            <a
                              href={link.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline"
                            >
                              Open
                            </a>
                          </div>
                        ))}
                        {distributionResult.links.length > 20 && (
                          <p className="text-xs text-gray-500">
                            ... and {distributionResult.links.length - 20} more
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      Templates
                    </h4>
                    <Button variant="ghost" size="sm" onClick={openCreateForm}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  {templates.length === 0 ? (
                    <p className="text-gray-500 text-sm text-center py-4">No templates</p>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {templates.map((template) => (
                        <div
                          key={template.id}
                          className="p-3 bg-white rounded border border-gray-200"
                        >
                          <div className="flex items-start justify-between mb-1">
                            <div>
                              <h5 className="font-medium text-sm">{template.name}</h5>
                              {template.isDefault && (
                                <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                                  Default
                                </span>
                              )}
                            </div>
                            <div className="flex gap-1">
                              <button
                                onClick={() => openEditForm(template)}
                                className="p-1 text-gray-400 hover:text-gray-600"
                              >
                                <Edit className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  setTemplateToDelete(template);
                                  setShowDeleteConfirm(true);
                                }}
                                className="p-1 text-gray-400 hover:text-red-500"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                          <p className="text-xs text-gray-500 line-clamp-2">{template.message}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
                  <h4 className="font-semibold text-blue-800 text-sm mb-2">Quick Tips</h4>
                  <ul className="text-xs text-blue-700 space-y-1">
                    <li>• Use {"{name}"} for customer name</li>
                    <li>• Use {"{code}"} for voucher code</li>
                    <li>• Use {"{discount}"} for discount value</li>
                    <li>• Use {"{expires}"} for expiration date</li>
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">Distribution History</h4>
              {history.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No distribution history yet</p>
              ) : (
                <div className="space-y-3">
                  {history.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        {getChannelIcon(item.channel)}
                        <div>
                          <p className="text-sm font-medium">
                            {item.channel.charAt(0).toUpperCase() + item.channel.slice(1)}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(item.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-gray-400" />
                        <span className="text-sm">{item.recipientCount} recipients</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {isFormOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-lg font-semibold">
                  {editingTemplate ? 'Edit Template' : 'New Template'}
                </h3>
                <button onClick={closeForm} className="text-gray-400 hover:text-gray-600">
                  <X className="h-6 w-6" />
                </button>
              </div>
              <form onSubmit={handleSubmitTemplate}>
                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Template Name *
                    </label>
                    <Input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., New Year Promo"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email Subject (optional)
                    </label>
                    <Input
                      type="text"
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      placeholder="e.g., Happy New Year! Here's your gift"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Message *
                    </label>
                    <textarea
                      className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      placeholder="Hi {name}, here's your voucher: {code} - {discount}"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Available: {"{name}"}, {"{code}"}, {"{discount}"}, {"{expires}"}, {"{store_name}"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isDefaultModal"
                      checked={formData.isDefault}
                      onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                      className="rounded border-gray-300"
                    />
                    <label htmlFor="isDefaultModal" className="text-sm text-gray-700">
                      Set as default template
                    </label>
                  </div>
                </div>
                <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={closeForm}>
                    Cancel
                  </Button>
                  <Button type="submit" isLoading={isSubmitting}>
                    {editingTemplate ? 'Save Changes' : 'Create Template'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showDeleteConfirm && templateToDelete && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white rounded-xl shadow-xl max-w-sm w-full">
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-2">Delete Template?</h3>
                <p className="text-gray-600">
                  Are you sure you want to delete "{templateToDelete.name}"?
                </p>
              </div>
              <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
                <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleDeleteTemplate}>
                  Delete
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
