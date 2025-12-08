/**
 * Brands Management Module
 * Экспорты для модуля управления брендами
 */

export { BrandsManager } from './components/BrandsManager';
export { BrandFormModal } from './components/BrandFormModal';
export {
  useBrands,
  useBrand,
  useCreateBrand,
  useUpdateBrand,
  useDeleteBrand,
  brandsKeys,
  type BrandFilters,
} from './hooks/useBrands';
