// Server-side data fetcher: quotes (Yahoo) + news (Google RSS) -> static JSON for the site.
import { writeFileSync } from 'fs';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';

const QUOTE_SYMS = ['^TNX','^TYX','DX-Y.NYB','^VIX','BTC-USD','ETH-USD',
  'AAPL','NVDA','TSLA','MSFT','AMZN','GOOGL','META','AMD','COIN','MSTR','HOOD','PLTR','RKLB','JPM','LLY',
  'ASML','NVO','SAP','SHEL','NSRGY','TSM','BABA','SONY','TM','HSBC','SE',
  'SPY','QQQ','IWM','XLK','SMH','XLE','ARKK','ARKX','VWO','EFA','EWJ','EWG','INDA','GLD','SLV','IBIT','ETHA','TLT',
  'GC=F','SI=F','HG=F','CL=F','NG=F','URA'];

async function quote(sym){
  try{
    const r = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(sym)+'?interval=1d&range=2d',{headers:{'User-Agent':UA}});
    const d = await r.json();
    const m = d?.chart?.result?.[0]?.meta;
    if(!m||m.regularMarketPrice==null) return {s:sym,px:null,ch:null};
    const prev = m.chartPreviousClose||m.previousClose;
    return {s:sym,px:m.regularMarketPrice,ch:prev?+(((m.regularMarketPrice-prev)/prev)*100).toFixed(2):null};
  }catch(e){ return {s:sym,px:null,ch:null}; }
}

function ago(t){ const mins=Math.floor((Date.now()-t)/60000);
  if(mins<60) return mins+'m'; const h=Math.floor(mins/60);
  return h<24? h+'h' : Math.floor(h/24)+'d'; }

async function news(q){
  try{
    const r = await fetch('https://news.google.com/rss/search?q='+encodeURIComponent(q)+'&hl=en-US&gl=US&ceid=US:en',{headers:{'User-Agent':UA}});
    const xml = await r.text();
    const items=[];
    for(const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)){
      if(items.length>=8) break;
      const b=m[1];
      const pick=t=>{const x=b.match(new RegExp('<'+t+'[^>]*>([\\s\\S]*?)</'+t+'>'));return x?x[1]:''};
      const dec=s=>(s||'').replace(/<!\[CDATA\[|\]\]>/g,'').replace(/&amp;/g,'&').replace(/&#39;|&apos;/g,"'").replace(/&quot;/g,'"').trim();
      const title=dec(pick('title')).replace(/ - [^-]+$/,'');
      if(title) items.push({title, link:dec(pick('link')), source:dec(pick('source'))||'news', t:ago(Date.parse(pick('pubDate'))||Date.now())});
    }
    return items;
  }catch(e){ return []; }
}

const quotes = [];
for(let i=0;i<QUOTE_SYMS.length;i+=6) quotes.push(...await Promise.all(QUOTE_SYMS.slice(i,i+6).map(quote)));
writeFileSync('data/quotes.json', JSON.stringify({ts:Date.now(), quotes}));

const bundles = {
  monad: await news('Monad blockchain crypto'),
  crypto: await news('crypto market bitcoin ethereum'),
  macro: await news('Fed rate cuts inflation markets'),
};
writeFileSync('data/news.json', JSON.stringify({ts:Date.now(), ...bundles}));
console.log('quotes:', quotes.filter(q=>q.px!=null).length+'/'+quotes.length,
  '| news m/c/M:', bundles.monad.length, bundles.crypto.length, bundles.macro.length);
