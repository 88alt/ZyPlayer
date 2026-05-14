import { apiRequest as request } from '@/utils/request';

export function dataDbClear(doc) {
  return request.request({
    url: '/v1/data/db/clear',
    method: 'delete',
    data: doc,
  });
}

export function dataDbExport(doc) {
  return request.request({
    url: '/v1/data/db/export',
    method: 'post',
    data: doc,
  });
}

export function dataDbCompleteImport(doc) {
  return request.request({
    url: '/v1/data/db/import/complete',
    method: 'post',
    data: doc,
  });
}

export function dataDbSimpleImport(doc) {
  return request.request({
    url: '/v1/data/db/import/simple',
    method: 'post',
    data: doc,
  });
}

export function dataCloudBackup() {
  return request.request({
    url: '/v1/data/cloud/backup',
    method: 'get',
  });
}

export function dataCloudResume() {
  return request.request({
    url: '/v1/data/cloud/resume',
    method: 'get',
  });
}
