interface CategoriesBarProps {
  categories: { id: string; name: string }[];
  selectedCategory: string | null;
  setSelectedCategory: (id: string | null) => void;
}

export function CategoriesBar({ categories, selectedCategory, setSelectedCategory }: CategoriesBarProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 px-6">
      <button
        onClick={() => setSelectedCategory(null)}
        className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
          !selectedCategory
            ? 'bg-primary-600 text-white'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
      >
        All
      </button>
      {categories.map((category) => (
        <button
          key={category.id}
          onClick={() => setSelectedCategory(category.id)}
          className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
            selectedCategory === category.id
              ? 'bg-primary-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {category.name}
        </button>
      ))}
    </div>
  );
}
