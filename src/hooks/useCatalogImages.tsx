import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CatalogProduct {
  id: string;
  name: string;
  image_url: string;
  price?: string;
  currency?: string;
  url?: string;
}

interface ProductCatalog {
  id: string;
  name: string;
  products: CatalogProduct[];
}

interface CatalogImagesResponse {
  success: boolean;
  catalogs: ProductCatalog[];
  totalCatalogs: number;
  totalProducts: number;
  error?: string;
  hint?: string;
}

export function useCatalogImages() {
  const [loading, setLoading] = useState(false);
  const [catalogs, setCatalogs] = useState<ProductCatalog[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchCatalogImages = useCallback(async (projectId: string) => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke<CatalogImagesResponse>(
        'fetch-catalog-images',
        { body: { projectId } }
      );

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (!data?.success) {
        const errorMsg = data?.error || 'Erro ao buscar catálogo';
        setError(errorMsg);
        
        if (data?.hint) {
          toast.error(errorMsg, { description: data.hint });
        } else {
          toast.error(errorMsg);
        }
        
        return null;
      }

      setCatalogs(data.catalogs);
      
      if (data.totalProducts === 0) {
        toast.info('Nenhum produto encontrado nos catálogos');
      } else {
        toast.success(`${data.totalProducts} produtos encontrados em ${data.totalCatalogs} catálogo(s)`);
      }

      return data;

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(errorMsg);
      toast.error('Erro ao buscar imagens do catálogo', { description: errorMsg });
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const getAllImages = useCallback(() => {
    return catalogs.flatMap(catalog => 
      catalog.products.map(product => ({
        ...product,
        catalogName: catalog.name,
        catalogId: catalog.id,
      }))
    );
  }, [catalogs]);

  return {
    loading,
    catalogs,
    error,
    fetchCatalogImages,
    getAllImages,
  };
}
