import { apiRequest as request } from '@/utils/request';

export function fetchPluginPage(doc) {
  return request.request({
    url: `/v1/plugin/page`,
    method: 'get',
    params: doc,
  });
}

export function putPlugin(doc) {
  return request.request({
    url: `/v1/plugin`,
    method: 'put',
    data: doc,
    timeout: 0,
  });
}

export function addPlugin(doc) {
  return request.request({
    url: `/v1/plugin`,
    method: 'post',
    data: doc,
    timeout: 0,
  });
}

export function delPlugin(doc) {
  return request.request({
    url: `/v1/plugin`,
    method: 'delete',
    data: doc,
    timeout: 0,
  });
}

export function fetchPluginDetail(id) {
  return request.request({
    url: `/v1/plugin/${id}`,
    method: 'get',
  });
}
