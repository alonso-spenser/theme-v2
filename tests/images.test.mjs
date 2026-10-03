import test from 'node:test';
import assert from 'node:assert/strict';
import {originalImageUrl, observeImages} from '../js/src/images.js';

test('image URL is idempotent and preserves query/fragment',()=>{
 assert.equal(originalImageUrl('/x/photo.webp?x=1#h'),'/x/photo.og.webp?x=1#h');
 assert.equal(originalImageUrl('/x/photo.og.webp'),'/x/photo.og.webp');
 assert.equal(originalImageUrl('/x/photo.webp!6'),'/x/photo.og.webp');
 assert.equal(originalImageUrl('/logo.svg'),'/logo.svg');
});
function setup(observer=true){
 let callback,cleanup;const requests=[];const watched=[];const ignored=[];
 const img={src:'small.webp',dataset:{original:'large.og.webp'},classList:{remove(){}},removeAttribute(){}};
 const section={all:()=>[img],cleanup:f=>cleanup=f};
 const browser={Image:class {constructor(){requests.push(this);}},IntersectionObserver:observer?class {
  constructor(cb,options){callback=cb;assert.equal(options.rootMargin,'300px 0px');}
  observe(i){watched.push(i);}unobserve(i){ignored.push(i);}disconnect(){watched.length=0;}
 }:undefined};
 observeImages(section,browser);
 return {img,requests,watched,ignored,intersect:()=>callback([{target:img,isIntersecting:true}]),cleanup:()=>cleanup()};
}
test('keep small image until intersecting and full download succeeds',()=>{
 const s=setup();assert.equal(s.requests.length,0);s.intersect();assert.equal(s.requests.length,1);
 assert.equal(s.img.src,'small.webp');s.requests[0].onload();assert.equal(s.img.src,'large.og.webp');
 s.intersect();assert.equal(s.requests.length,1);s.cleanup();assert.equal(s.watched.length,0);
});
test('failure keeps placeholder and disposal prevents stale replacement',()=>{
 const s=setup();s.intersect();s.requests[0].onerror();assert.equal(s.img.src,'small.webp');
 const second=setup();second.intersect();const complete=second.requests[0].onload;second.cleanup();complete();
 assert.equal(second.img.src,'small.webp');
});
test('fallback loads without IntersectionObserver',()=>{
 const s=setup(false);assert.equal(s.requests.length,1);s.requests[0].onload();assert.equal(s.img.src,'large.og.webp');
});
