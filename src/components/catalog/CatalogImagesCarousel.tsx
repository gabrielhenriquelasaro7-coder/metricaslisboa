import { useState } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, Loader2, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useCatalogImages } from '@/hooks/useCatalogImages';

interface CatalogImagesCarouselProps {
  projectId: string;
}

export function CatalogImagesCarousel({ projectId }: CatalogImagesCarouselProps) {
  const { loading, catalogs, fetchCatalogImages, getAllImages } = useCatalogImages();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [hasFetched, setHasFetched] = useState(false);

  const handleFetch = async () => {
    await fetchCatalogImages(projectId);
    setHasFetched(true);
    setCurrentIndex(0);
  };

  const allImages = getAllImages();
  const currentImage = allImages[currentIndex];

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? allImages.length - 1 : prev - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev === allImages.length - 1 ? 0 : prev + 1));
  };

  if (!hasFetched) {
    return (
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ShoppingBag className="h-4 w-4 text-primary" />
            Catálogo de Produtos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <ShoppingBag className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-sm text-muted-foreground mb-4">
              Carregue as imagens do catálogo vinculado à conta de anúncios
            </p>
            <Button onClick={handleFetch} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Buscando...
                </>
              ) : (
                <>
                  <ShoppingBag className="mr-2 h-4 w-4" />
                  Buscar Catálogo
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (allImages.length === 0) {
    return (
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ShoppingBag className="h-4 w-4 text-primary" />
            Catálogo de Produtos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Nenhum produto encontrado no catálogo
            </p>
            <Button variant="outline" onClick={handleFetch} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Buscando...
                </>
              ) : (
                'Tentar Novamente'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <ShoppingBag className="h-4 w-4 text-primary" />
            Catálogo de Produtos
          </CardTitle>
          <Badge variant="secondary" className="text-xs">
            {currentIndex + 1} / {allImages.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Image Display */}
        <div className="relative aspect-square bg-muted/30 rounded-lg overflow-hidden">
          <img
            src={currentImage.image_url}
            alt={currentImage.name}
            className="w-full h-full object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/placeholder.svg';
            }}
          />
          
          {/* Navigation Arrows */}
          {allImages.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background/90 backdrop-blur-sm"
                onClick={goToPrevious}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background/90 backdrop-blur-sm"
                onClick={goToNext}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </>
          )}
        </div>

        {/* Product Info */}
        <div className="space-y-2">
          <h4 className="font-medium text-sm line-clamp-2">{currentImage.name}</h4>
          
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{currentImage.catalogName}</span>
            {currentImage.price && (
              <span className="font-medium text-foreground">
                {currentImage.currency} {currentImage.price}
              </span>
            )}
          </div>

          {currentImage.url && (
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-2"
              onClick={() => window.open(currentImage.url, '_blank')}
            >
              <ExternalLink className="mr-2 h-3 w-3" />
              Ver Produto
            </Button>
          )}
        </div>

        {/* Thumbnail Navigation */}
        {allImages.length > 1 && allImages.length <= 10 && (
          <div className="flex gap-1 justify-center flex-wrap">
            {allImages.map((img, idx) => (
              <button
                key={img.id}
                onClick={() => setCurrentIndex(idx)}
                className={`w-10 h-10 rounded-md overflow-hidden border-2 transition-all ${
                  idx === currentIndex 
                    ? 'border-primary' 
                    : 'border-transparent opacity-60 hover:opacity-100'
                }`}
              >
                <img
                  src={img.image_url}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        )}

        {/* Refresh Button */}
        <Button 
          variant="ghost" 
          size="sm" 
          className="w-full text-xs"
          onClick={handleFetch}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
          ) : null}
          Atualizar Catálogo
        </Button>
      </CardContent>
    </Card>
  );
}
