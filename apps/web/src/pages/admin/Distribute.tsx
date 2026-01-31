import { useState, useEffect, useCallback } from 'react';
import { Button, Input, Select } from '@pos/ui';
import { Plus, Trash2, Edit, Send, Eye, Users, MessageSquare, Mail, Printer, X, Gift } from 'lucide-react';
import { distributionApi, type MessageTemplate, type DistributionHistory } from '@/services/distribution';
import { customerApi, type CustomerGroup } from '@/services/customer';
import { useToast } from '@pos/ui';

interface TemplateFormData {
  name: string;
  subject: string;
  message: string;
  isDefault: boolean;
}

export default function Distribute() {
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

  const [voucherCode, setVoucherCode] = useState('');
  const [recipientType, setRecipientType] = useState<'all' | 'group' | 'individual' | 'manual'>('all');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [individualPhone, setIndividualPhone] = useState('');
  const [manualPhones, setManualPhones] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [previewMessage, setPreviewMessage] = useState('');
  const [isDistributing, setIsDistributing] = useState(false);
  const [distributionResult, setDistributionResult] = useState<{ recipientCount: number; links: Array<{ channel: string; link: string; recipient: string }> } | null>(null);

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
    loadData();
  }, [loadData]);

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
    if (!voucherCode || !selectedTemplate) {
      showError('Please enter voucher code and select a template');
      return;
    }

    try {
      const response = await distributionApi.preview({
        templateId: selectedTemplate,
        voucherCode,
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
    if (!voucherCode) {
      showError('Please enter a voucher code');
      return;
    }

    setIsDistributing(true);
    setDistributionResult(null);

    try {
      const input: Parameters<typeof distributionApi.distribute>[0] = {
        voucherCode,
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
        showError(response.error || 'Failed to load data');
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

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Send className="h-6 w-6" />
            Voucher Distribution
          </h1>
          <p className="text-gray-600">Send vouchers to customers via WhatsApp, Email, or Print</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Gift className="h-5 w-5" />
              Distribute Voucher
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Voucher Code *
                </label>
                <Input
                  type="text"
                  value={voucherCode}
                  onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                  placeholder="Enter voucher code (e.g., GC-XXXXX)"
                />
              </div>

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

              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={handlePreview}
                  disabled={!voucherCode || !selectedTemplate}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Preview
                </Button>
                <Button
                  onClick={handleDistribute}
                  isLoading={isDistributing}
                  disabled={!voucherCode}
                >
                  <Send className="h-4 w-4 mr-2" />
                  Generate Links
                </Button>
              </div>
            </div>

            {previewMessage && (
              <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Preview:</h4>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{previewMessage}</p>
              </div>
            )}

            {distributionResult && (
              <div className="mt-6 p-4 bg-green-50 rounded-lg border border-green-200">
                <h4 className="text-sm font-medium text-green-800 mb-2">
                  Distribution Ready ({distributionResult.recipientCount} recipients)
                </h4>
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {distributionResult.links.slice(0, 50).map((link, index) => (
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
                  {distributionResult.links.length > 50 && (
                    <p className="text-xs text-gray-500">
                      ... and {distributionResult.links.length - 50} more
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4">Distribution History</h2>

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
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Templates
              </h2>
              <Button variant="ghost" size="sm" onClick={openCreateForm}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {templates.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No templates</p>
            ) : (
              <div className="space-y-3">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-medium">{template.name}</h4>
                        {template.isDefault && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                            Default
                          </span>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditForm(template)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setTemplateToDelete(template);
                            setShowDeleteConfirm(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 line-clamp-2">{template.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-blue-50 rounded-xl border border-blue-200 p-6">
            <h3 className="font-semibold text-blue-800 mb-2">Quick Tips</h3>
            <ul className="text-sm text-blue-700 space-y-2">
              <li>• Use {"{name}"} for customer name</li>
              <li>• Use {"{code}"} for voucher code</li>
              <li>• Use {"{discount}"} for discount value</li>
              <li>• Use {"{expires}"} for expiration date</li>
              <li>• Use {"{store_name}"} for store name</li>
            </ul>
          </div>
        </div>
      </div>

      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
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
                    id="isDefault"
                    checked={formData.isDefault}
                    onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                    className="rounded border-gray-300"
                  />
                  <label htmlFor="isDefault" className="text-sm text-gray-700">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
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
  );
}
