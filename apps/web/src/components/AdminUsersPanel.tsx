import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ApiError } from "../types.js";
import {
  listAdminUserDocuments,
  listAdminUsers,
  deleteAdminDocument,
  uploadAdminUserDocument,
  type AdminUser,
} from "../api/admin.js";
import { DocumentTable } from "./DocumentTable.js";
import { UploadPanel } from "./UploadPanel.js";

function formatDate(iso: string): string {
  return iso.slice(0, 16).replace("T", " ");
}

function authSourceLabel(source: AdminUser["authSource"]): string {
  switch (source) {
    case "local":
      return "本地";
    case "cas":
      return "CAS";
    case "system":
      return "系统";
    default:
      return source;
  }
}

export function AdminUsersPanel() {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const usersQuery = useQuery({
    queryKey: ["admin", "users"],
    queryFn: listAdminUsers,
  });

  const selectedUser = usersQuery.data?.find((user) => user.id === selectedUserId);

  if (usersQuery.isLoading) {
    return <p className="muted">加载用户列表…</p>;
  }

  if (usersQuery.error) {
    const message =
      usersQuery.error instanceof ApiError
        ? usersQuery.error.message
        : usersQuery.error instanceof Error
          ? usersQuery.error.message
          : "加载失败";
    return <div className="banner-error">请求失败：{message}</div>;
  }

  const users = usersQuery.data ?? [];

  return (
    <div className="admin-panel panel-stack">
      <section>
        <h2 className="section-title">用户列表</h2>
        <p className="muted">点击行查看并管理该用户的文档。</p>
        <div className="doc-table-wrap">
          <table className="doc-table admin-user-table">
            <thead>
              <tr>
                <th>工号</th>
                <th>来源</th>
                <th>角色</th>
                <th>文档数</th>
                <th>创建时间</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr
                  key={user.id}
                  className={
                    selectedUserId === user.id ? "admin-user-row selected" : "admin-user-row"
                  }
                  onClick={() => setSelectedUserId(user.id)}
                >
                  <td>{user.employeeId}</td>
                  <td>{authSourceLabel(user.authSource)}</td>
                  <td>{user.role === "admin" ? "管理员" : "用户"}</td>
                  <td>{user.documentCount}</td>
                  <td className="muted">{formatDate(user.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {selectedUser ? (
        <section className="admin-user-docs">
          <h2 className="section-title">
            工号 {selectedUser.employeeId} 的文档
          </h2>
          <UploadPanel
            hint={`代用户 ${selectedUser.employeeId} 上传文件`}
            queryKey={["admin", "documents", selectedUser.id]}
            uploadFn={(file) => uploadAdminUserDocument(selectedUser.id, file)}
          />
          <DocumentTable
            queryKey={["admin", "documents", selectedUser.id]}
            listFn={() => listAdminUserDocuments(selectedUser.id)}
            deleteFn={deleteAdminDocument}
            canDeleteDoc={() => true}
            emptyTitle="该用户暂无文档"
            emptyDescription="使用上方上传区域为该用户添加文档。"
          />
        </section>
      ) : (
        <p className="muted">请从列表中选择一个用户。</p>
      )}
    </div>
  );
}
