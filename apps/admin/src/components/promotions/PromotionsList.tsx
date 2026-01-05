import { useState } from 'react';
import { Search, Plus, MoreVertical, Edit, Trash2, Eye, GripVertical } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Promotion {
  id: string;
  storeId: string | null;
  name: string;
  description: string | null;
  bannerImageUrl: string;
  discountId: string | null;
  colorTheme: string;
  displayPriority: number;
  displayDuration: number;
  showOnDisplay: boolean;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface PromotionsListProps {
  promotions: Promotion[];
  isLoading: boolean;
  searchQuery: string;
  statusFilter: 'all' | 'active' | 'inactive';
  onSearchChange: (query: string) => void;
  onStatusFilterChange: (filter: 'all' | 'active' | 'inactive') => void;
  onCreate: () => void;
  onEdit: (promotion: Promotion) => void;
  onDelete: (promotion: Promotion) => void;
  onPreview: (promotion: Promotion) => void;
  onReorder: (promotions: Promotion[]) => void;
}

function PromotionRow({
  promotion,
  formatDate,
  onEdit,
  onDelete,
  onPreview,
  openMenuId,
  setOpenMenuId,
  dragHandleProps,
}: {
  promotion: Promotion;
  formatDate: (date: string | null) => string;
  onEdit: (p: Promotion) => void;
  onDelete: (p: Promotion) => void;
  onPreview: (p: Promotion) => void;
  openMenuId: string | null;
  setOpenMenuId: (id: string | null) => void;
  dragHandleProps?: {
    ref: (node: HTMLElement | null) => void;
    attributes: Record<string, unknown> | undefined;
    listeners: Record<string, unknown> | undefined;
  };
}) {
  return (
    <div className="p-4 flex items-center gap-4 hover:bg-gray-50">
      {/* Drag Handle */}
      <button
        className="p-1 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing"
        title="Drag to reorder"
        {...(dragHandleProps?.attributes || {})}
        {...((dragHandleProps?.listeners || {}) as React.HTMLAttributes<HTMLButtonElement>)}
      >
        <GripVertical className="w-5 h-5" />
      </button>

      {/* Preview Thumbnail */}
      <div className="w-16 h-10 rounded overflow-hidden bg-gray-100 shrink-0">
        {promotion.bannerImageUrl ? (
          <img
            src={promotion.bannerImageUrl}
            alt={promotion.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <Eye className="w-4 h-4" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-gray-900 truncate">{promotion.name}</h3>
          <span
            className={`px-2 py-0.5 text-xs rounded-full ${
              promotion.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {promotion.isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
        <p className="text-sm text-gray-500 truncate">{promotion.description || 'No description'}</p>
        <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
          <span>Priority: {promotion.displayPriority}</span>
          <span>Duration: {promotion.displayDuration}s</span>
          {promotion.startDate && (
            <span>
              {formatDate(promotion.startDate)} - {formatDate(promotion.endDate)}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="relative">
        <button
          onClick={() => setOpenMenuId(openMenuId === promotion.id ? null : promotion.id)}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <MoreVertical className="w-5 h-5 text-gray-400" />
        </button>

        {openMenuId === promotion.id && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
            <div className="absolute right-0 mt-1 w-36 bg-white rounded-lg shadow-lg border z-20 py-1">
              <button
                onClick={() => {
                  onPreview(promotion);
                  setOpenMenuId(null);
                }}
                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
              >
                <Eye className="w-4 h-4" />
                Preview
              </button>
              <button
                onClick={() => {
                  onEdit(promotion);
                  setOpenMenuId(null);
                }}
                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
              >
                <Edit className="w-4 h-4" />
                Edit
              </button>
              <button
                onClick={() => {
                  onDelete(promotion);
                  setOpenMenuId(null);
                }}
                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 text-red-600 flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SortablePromotionRow({
  promotion,
  formatDate,
  onEdit,
  onDelete,
  onPreview,
  openMenuId,
  setOpenMenuId,
}: {
  promotion: Promotion;
  formatDate: (date: string | null) => string;
  onEdit: (p: Promotion) => void;
  onDelete: (p: Promotion) => void;
  onPreview: (p: Promotion) => void;
  openMenuId: string | null;
  setOpenMenuId: (id: string | null) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useSortable({ id: promotion.id });

  const style: React.CSSProperties = {
    opacity: isDragging ? 0.5 : 1,
    transition: 'opacity 150ms ease',
  };

  return (
    <div ref={setNodeRef} style={style}>
      <PromotionRow
        promotion={promotion}
        formatDate={formatDate}
        onEdit={onEdit}
        onDelete={onDelete}
        onPreview={onPreview}
        openMenuId={openMenuId}
        setOpenMenuId={setOpenMenuId}
        dragHandleProps={{
          ref: setNodeRef,
          attributes: attributes as unknown as Record<string, unknown>,
          listeners: listeners as unknown as Record<string, unknown> | undefined,
        }}
      />
    </div>
  );
}

function DragOverlayRow({ promotion }: { promotion: Promotion }) {
  const { attributes, listeners, setNodeRef, isDragging, transform } = useSortable({ id: promotion.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    opacity: isDragging ? 1 : 0.9,
    transition: 'transform 0ms',
    cursor: 'grabbing',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="p-4 flex items-center gap-4 bg-white rounded-lg shadow-xl border-2 border-blue-500"
    >
      <button
        className="p-1 text-blue-500 cursor-grabbing"
        {...(attributes as unknown as React.HTMLAttributes<HTMLButtonElement>)}
        {...(listeners as React.HTMLAttributes<HTMLButtonElement>)}
      >
        <GripVertical className="w-5 h-5" />
      </button>

      <div className="w-16 h-10 rounded overflow-hidden bg-gray-100 shrink-0">
        {promotion.bannerImageUrl ? (
          <img src={promotion.bannerImageUrl} alt={promotion.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <Eye className="w-4 h-4" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-gray-900 truncate">{promotion.name}</h3>
          <span
            className={`px-2 py-0.5 text-xs rounded-full ${
              promotion.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {promotion.isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
        <p className="text-sm text-gray-500 truncate">{promotion.description || 'No description'}</p>
      </div>
    </div>
  );
}

export function PromotionsList({
  promotions,
  isLoading,
  searchQuery,
  statusFilter,
  onSearchChange,
  onStatusFilterChange,
  onCreate,
  onEdit,
  onDelete,
  onPreview,
  onReorder,
}: PromotionsListProps) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const filteredPromotions = promotions.filter((p) => {
    const matchesSearch =
      !searchQuery ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' || (statusFilter === 'active' && p.isActive) || (statusFilter === 'inactive' && !p.isActive);

    return matchesSearch && matchesStatus;
  });

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'No date';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = promotions.findIndex((p) => p.id === active.id);
      const newIndex = promotions.findIndex((p) => p.id === over.id);

      const reordered = [...promotions];
      const [moved] = reordered.splice(oldIndex, 1);
      reordered.splice(newIndex, 0, moved);

      onReorder(reordered);
    }

    setActiveId(null);
    setOpenMenuId(null);
  };

  const activePromotion = activeId ? promotions.find((p) => p.id === activeId) : null;

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search promotions..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value as typeof statusFilter)}
            className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        <button
          onClick={onCreate}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          New Promotion
        </button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="p-8 text-center text-gray-500">Loading...</div>
      ) : filteredPromotions.length === 0 ? (
        <div className="p-8 text-center text-gray-500">
          {searchQuery || statusFilter !== 'all'
            ? 'No promotions match your filters'
            : 'No promotions yet. Create your first promotion!'}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={filteredPromotions.map((p) => p.id)} strategy={verticalListSortingStrategy}>
            <div className="divide-y">
              {filteredPromotions.map((promotion) => (
                <SortablePromotionRow
                  key={promotion.id}
                  promotion={promotion}
                  formatDate={formatDate}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onPreview={onPreview}
                  openMenuId={openMenuId}
                  setOpenMenuId={setOpenMenuId}
                />
              ))}
            </div>
          </SortableContext>

          <DragOverlay>{activePromotion && <DragOverlayRow promotion={activePromotion} />}</DragOverlay>
        </DndContext>
      )}

      {/* Footer */}
      <div className="p-4 border-t text-sm text-gray-500">
        Showing {filteredPromotions.length} of {promotions.length} promotions
      </div>
    </div>
  );
}
