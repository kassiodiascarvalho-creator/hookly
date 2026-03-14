import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface TrackingPixel {
  pixel_type: string;
  pixel_id: string;
  is_active: boolean;
}

/**
 * Component that loads and injects tracking pixels (Facebook, Google Analytics, GTM)
 * based on the configuration stored in the database.
 */
export function TrackingPixelsLoader() {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (loaded) return;

    const loadPixels = async () => {
      try {
        const { data, error } = await supabase
          .from("tracking_pixels" as any)
          .select("*")
          .eq("is_active", true);

        if (error) {
          console.error("Error loading tracking pixels:", error);
          return;
        }

        const pixels = data as unknown as TrackingPixel[];

        pixels.forEach((pixel) => {
          switch (pixel.pixel_type) {
            case "facebook_pixel":
              injectFacebookPixel(pixel.pixel_id);
              break;
            case "google_analytics":
              injectGoogleAnalytics(pixel.pixel_id);
              break;
            case "google_tag_manager":
              injectGoogleTagManager(pixel.pixel_id);
              break;
          }
        });

        setLoaded(true);
      } catch (error) {
        console.error("Error in TrackingPixelsLoader:", error);
      }
    };

    loadPixels();
  }, [loaded]);

  return null;
}

function injectFacebookPixel(pixelId: string) {
  if (!pixelId || document.getElementById("fb-pixel-script")) return;

  // Facebook Pixel base code
  const script = document.createElement("script");
  script.id = "fb-pixel-script";
  script.innerHTML = `
    !function(f,b,e,v,n,t,s)
    {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
    n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t,s)}(window, document,'script',
    'https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', '${pixelId}');
    fbq('track', 'PageView');
  `;
  document.head.appendChild(script);

  // NoScript fallback
  const noscript = document.createElement("noscript");
  noscript.id = "fb-pixel-noscript";
  noscript.innerHTML = `<img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1"/>`;
  document.body.appendChild(noscript);

  console.log("Facebook Pixel loaded:", pixelId);
}

function injectGoogleAnalytics(measurementId: string) {
  if (!measurementId || document.getElementById("ga4-script")) return;

  // Google Analytics 4 gtag.js
  const script1 = document.createElement("script");
  script1.id = "ga4-script";
  script1.async = true;
  script1.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(script1);

  const script2 = document.createElement("script");
  script2.id = "ga4-config";
  script2.innerHTML = `
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', '${measurementId}');
  `;
  document.head.appendChild(script2);

  console.log("Google Analytics 4 loaded:", measurementId);
}

function injectGoogleTagManager(containerId: string) {
  if (!containerId || document.getElementById("gtm-script")) return;

  // Google Tag Manager script
  const script = document.createElement("script");
  script.id = "gtm-script";
  script.innerHTML = `
    (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
    new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
    j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
    'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
    })(window,document,'script','dataLayer','${containerId}');
  `;
  document.head.appendChild(script);

  // GTM noscript fallback
  const noscript = document.createElement("noscript");
  noscript.id = "gtm-noscript";
  noscript.innerHTML = `<iframe src="https://www.googletagmanager.com/ns.html?id=${containerId}" height="0" width="0" style="display:none;visibility:hidden"></iframe>`;
  document.body.insertBefore(noscript, document.body.firstChild);

  console.log("Google Tag Manager loaded:", containerId);
}
