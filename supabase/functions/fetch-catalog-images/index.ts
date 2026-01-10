import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { projectId } = await req.json();

    if (!projectId) {
      throw new Error("projectId is required");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get project to find ad_account_id
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("ad_account_id, name")
      .eq("id", projectId)
      .single();

    if (projectError || !project) {
      throw new Error("Project not found");
    }

    const adAccountId = project.ad_account_id;
    const META_ACCESS_TOKEN = Deno.env.get("META_ACCESS_TOKEN");

    if (!META_ACCESS_TOKEN) {
      throw new Error("META_ACCESS_TOKEN not configured");
    }

    // Format ad account ID (add act_ prefix if not present)
    const formattedAdAccountId = adAccountId.startsWith("act_") 
      ? adAccountId 
      : `act_${adAccountId}`;

    console.log(`Fetching catalogs for ad account: ${formattedAdAccountId}`);

    // Step 1: Get product catalogs linked to this ad account
    const catalogsUrl = `https://graph.facebook.com/v21.0/${formattedAdAccountId}/product_catalogs?fields=id,name&access_token=${META_ACCESS_TOKEN}`;
    
    const catalogsResponse = await fetch(catalogsUrl);
    const catalogsData = await catalogsResponse.json();

    if (catalogsData.error) {
      console.error("Meta API error fetching catalogs:", catalogsData.error);
      
      // If product_catalogs doesn't work, try getting from business
      // Some accounts need different permissions
      return new Response(
        JSON.stringify({
          success: false,
          error: catalogsData.error.message,
          hint: "Verifique se o token tem permissão 'catalog_management' e se a conta está vinculada a um catálogo.",
          catalogs: [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const catalogs: ProductCatalog[] = [];

    if (catalogsData.data && catalogsData.data.length > 0) {
      // Step 2: For each catalog, fetch products with images
      for (const catalog of catalogsData.data) {
        console.log(`Fetching products for catalog: ${catalog.name} (${catalog.id})`);

        const productsUrl = `https://graph.facebook.com/v21.0/${catalog.id}/products?fields=id,name,image_url,price,currency,url&limit=50&access_token=${META_ACCESS_TOKEN}`;
        
        const productsResponse = await fetch(productsUrl);
        const productsData = await productsResponse.json();

        if (productsData.error) {
          console.error(`Error fetching products for catalog ${catalog.id}:`, productsData.error);
          continue;
        }

        const products: CatalogProduct[] = (productsData.data || [])
          .filter((p: any) => p.image_url)
          .map((p: any) => ({
            id: p.id,
            name: p.name || "Produto sem nome",
            image_url: p.image_url,
            price: p.price,
            currency: p.currency,
            url: p.url,
          }));

        catalogs.push({
          id: catalog.id,
          name: catalog.name,
          products,
        });
      }
    }

    const totalProducts = catalogs.reduce((sum, c) => sum + c.products.length, 0);

    console.log(`Found ${catalogs.length} catalogs with ${totalProducts} products total`);

    return new Response(
      JSON.stringify({
        success: true,
        catalogs,
        totalCatalogs: catalogs.length,
        totalProducts,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in fetch-catalog-images:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        catalogs: [],
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
