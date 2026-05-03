import { apiRequest as request } from '@/utils/request';

/** site */

export function addSite(doc) {
  return request.request({
    url: `/v1/film/site`,
    method: 'post',
    data: doc,
  });
}

export function delSite(doc) {
  return request.request({
    url: `/v1/film/site`,
    method: 'delete',
    data: doc,
  });
}

export function putSite(doc) {
  return request.request({
    url: `/v1/film/site`,
    method: 'put',
    data: doc,
  });
}

export function putSiteDefault(id) {
  return request.request({
    url: `/v1/film/site/default/${id}`,
    method: 'put',
  });
}

export function fetchSiteActive() {
  return request.request({
    url: '/v1/film/site/active',
    method: 'get',
  });
}

export function fetchSitePage(doc) {
  return request.request({
    url: `/v1/film/site/page`,
    method: 'get',
    params: doc,
  });
}

export function fetchSiteDetail(id) {
  return request.request({
    url: `/v1/film/site/${id}`,
    method: 'get',
  });
}

export function fetchSiteDetailByKey(key) {
  return request.request({
    url: `/v1/film/site/key/${key}`,
    method: 'get',
  });
}

/** cms */

export function fetchCmsInit(opt) {
  const { signal, ...doc } = opt;
  return request.request({
    url: '/v1/film/cms/init',
    method: 'get',
    params: doc,
    ...(signal ? { signal } : {}),
  });
}

export function fetchCmsHome(opt) {
  const { signal, ...doc } = opt;
  return request.request({
    url: '/v1/film/cms/home',
    method: 'get',
    params: doc,
    ...(signal ? { signal } : {}),
  });
}

export function fetchCmsHomeVod(opt) {
  const { signal, ...doc } = opt;
  return request.request({
    url: '/v1/film/cms/homeVod',
    method: 'get',
    params: doc,
    ...(signal ? { signal } : {}),
  });
}

export function fetchCmsCategory(opt) {
  const { signal, ...doc } = opt;
  return request.request({
    url: '/v1/film/cms/category',
    method: 'get',
    params: doc,
    ...(signal ? { signal } : {}),
  });
}

export function fetchCmsSearch(opt) {
  const { signal, ...doc } = opt;
  return request.request({
    url: '/v1/film/cms/search',
    method: 'get',
    params: doc,
    ...(signal ? { signal } : {}),
  });
}

export function fetchCmsDetail(opt) {
  const { signal, ...doc } = opt;
  return request.request({
    url: '/v1/film/cms/detail',
    method: 'get',
    params: doc,
    ...(signal ? { signal } : {}),
  });
}

export function fetchCmsPlay(opt) {
  const { signal, ...doc } = opt;
  return request.request({
    url: '/v1/film/cms/play',
    method: 'get',
    params: doc,
    ...(signal ? { signal } : {}),
  });
}

export function fetchCmsAction(opt) {
  const { signal, timeout, ...doc } = opt;
  return request.request({
    url: '/v1/film/cms/action',
    method: 'get',
    params: doc,
    ...(timeout ? { timeout } : {}),
    ...(signal ? { signal } : {}),
  });
}

export function fetchCmsProxy(opt) {
  const { signal, ...doc } = opt;
  return request.request({
    url: '/v1/film/cms/proxy',
    method: 'get',
    params: doc,
    ...(signal ? { signal } : {}),
  });
}

export function fetchCmsCheck(opt) {
  const { signal, ...doc } = opt;
  return request.request({
    url: '/v1/film/cms/check',
    method: 'get',
    params: doc,
    ...(signal ? { signal } : {}),
  });
}

/** recommend */

export function fetchRecBarrage(doc) {
  return request.request({
    url: '/v1/film/rec/barrage',
    method: 'get',
    params: doc,
  });
}

export function sendRecBarrage(doc) {
  return request.request({
    url: '/v1/film/rec/barrage',
    method: 'post',
    data: doc,
  });
}

export function fetchRecHot(doc) {
  return request.request({
    url: '/v1/film/rec/hot',
    method: 'get',
    params: doc,
  });
}

export function fetchRecAssociation(doc) {
  return request.request({
    url: '/v1/film/rec/association',
    method: 'get',
    params: doc,
  });
}

export function fetchRecMatch(doc) {
  return request.request({
    url: '/v1/film/rec/match',
    method: 'get',
    params: doc,
  });
}

/** edit */

export function fetchEditDomPd(doc) {
  return request.request({
    url: `/v1/film/edit/dom/pd`,
    method: 'POST',
    data: doc,
  });
}

export function fetchEditDomPdfa(doc) {
  return request.request({
    url: `/v1/film/edit/dom/pdfa`,
    method: 'POST',
    data: doc,
  });
}

export function fetchEditDomPdfh(doc) {
  return request.request({
    url: `/v1/film/edit/dom/pdfh`,
    method: 'POST',
    data: doc,
  });
}

export function fetchEditDomPdfl(doc) {
  return request.request({
    url: `/v1/film/edit/dom/pdfl`,
    method: 'POST',
    data: doc,
  });
}

export function fetchEditSiftCategory(doc) {
  return request.request({
    url: `/v1/film/edit/sift/category`,
    method: 'POST',
    data: doc,
  });
}

export function fetchEditSiftFilter(doc) {
  return request.request({
    url: `/v1/film/edit/sift/filter`,
    method: 'POST',
    data: doc,
  });
}

export function fetchEditTemplates(type) {
  return request.request({
    url: `/v1/film/edit/template/${type}`,
    method: 'GET',
  });
}

export function fetchEditTemplateDetail(type, name) {
  return request.request({
    url: `/v1/film/edit/template/${type}/${name}`,
    method: 'GET',
  });
}

export function fetchEditDecrypt(type, doc) {
  return request.request({
    url: `/v1/film/edit/decrypt/${type}`,
    method: 'POST',
    data: doc,
  });
}
