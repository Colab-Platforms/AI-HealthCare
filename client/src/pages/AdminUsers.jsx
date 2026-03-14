import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, Search, Filter, MoreVertical, Shield, Mail, Calendar, Activity, ChevronLeft, ChevronRight, UserCheck, UserX, Eye } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';

export default function AdminUsers() {
    const [users, setUsers] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pages, setPages] = useState(1);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [selectedUser, setSelectedUser] = useState(null);
    const [userDetail, setUserDetail] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [roleModalUser, setRoleModalUser] = useState(null); // user currently being role-changed
    const [updatingRole, setUpdatingRole] = useState(false);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page, limit: 15 });
            if (roleFilter) params.append('role', roleFilter);
            if (statusFilter) params.append('status', statusFilter);
            const { data } = await api.get(`admin/users?${params}`);
            setUsers(data.users || []);
            setTotal(data.total || 0);
            setPages(data.pages || 1);
        } catch (err) {
            toast.error('Failed to load users');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchUsers(); }, [page, roleFilter, statusFilter]);

    const toggleUserStatus = async (userId, currentStatus) => {
        try {
            await api.patch(`admin/users/${userId}/status`, { isActive: !currentStatus });
            toast.success(`User ${!currentStatus ? 'activated' : 'deactivated'}`);
            fetchUsers();
        } catch (err) {
            toast.error('Failed to update user status');
        }
    };

    const handleRoleChange = async (userId, newRole) => {
        setUpdatingRole(true);
        try {
            await api.patch(`admin/users/${userId}/role`, { role: newRole });
            toast.success(`Role updated to ${newRole}`);
            setRoleModalUser(null);
            fetchUsers();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to update role');
        } finally {
            setUpdatingRole(false);
        }
    };

    const viewUserDetail = async (userId) => {
        setDetailLoading(true);
        setSelectedUser(userId);
        try {
            const { data } = await api.get(`admin/users/${userId}`);
            setUserDetail(data);
        } catch (err) {
            toast.error('Failed to load user details');
        } finally {
            setDetailLoading(false);
        }
    };

    const filteredUsers = search
        ? users.filter(u => u.name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase()))
        : users;

    const getRoleBadge = (role) => {
        const colors = {
            admin: 'bg-red-50 text-red-700 border-red-200',
            doctor: 'bg-blue-50 text-blue-700 border-blue-200',
            patient: 'bg-emerald-50 text-emerald-700 border-emerald-200',
            client: 'bg-purple-50 text-purple-700 border-purple-200',
        };
        return colors[role] || 'bg-slate-50 text-slate-700 border-slate-200';
    };

    return (
        <div className="min-h-full p-4 md:p-8 font-sans">
            <div className="max-w-[1200px] mx-auto space-y-6">

                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-[#1a1a1a]">User Management</h1>
                        <p className="text-sm text-slate-500 mt-1">{total} total users registered</p>
                    </div>
                </div>

                {/* Filters */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white/80 backdrop-blur-xl rounded-2xl p-4 border border-white/50 shadow-sm flex flex-col md:flex-row gap-3"
                >
                    <div className="flex-1 relative">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search by name or email..."
                            className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-purple-200"
                        />
                    </div>
                    <select
                        value={roleFilter}
                        onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
                        className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none"
                    >
                        <option value="">All Roles</option>
                        <option value="patient">Patients</option>
                        <option value="doctor">Doctors</option>
                        <option value="admin">Admins</option>
                    </select>
                    <select
                        value={statusFilter}
                        onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                        className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none"
                    >
                        <option value="">All Status</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                    </select>
                </motion.div>

                {/* Users Table */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/50 shadow-sm overflow-hidden"
                >
                    {loading ? (
                        <div className="p-12 text-center">
                            <div className="w-8 h-8 border-2 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto" />
                            <p className="text-sm text-slate-500 mt-3">Loading users...</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-slate-100">
                                        <th className="text-left px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">User</th>
                                        <th className="text-left px-4 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest hidden md:table-cell">Email</th>
                                        <th className="text-center px-4 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Role</th>
                                        <th className="text-center px-4 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Status</th>
                                        <th className="text-center px-4 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest hidden md:table-cell">Joined</th>
                                        <th className="text-center px-4 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredUsers.map((u) => (
                                        <tr key={u._id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-400 to-blue-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                                                        {u.name?.[0]?.toUpperCase() || '?'}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-semibold text-[#1a1a1a] truncate max-w-[150px]">{u.name}</p>
                                                        <p className="text-[11px] text-slate-400 md:hidden truncate max-w-[150px]">{u.email}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 hidden md:table-cell">
                                                <p className="text-sm text-slate-600 truncate max-w-[200px]">{u.email}</p>
                                            </td>
                                            <td className="px-4 py-4 text-center">
                                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border ${getRoleBadge(u.role)}`}>
                                                    {u.role}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4 text-center">
                                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${u.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${u.isActive ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                                    {u.isActive ? 'Active' : 'Inactive'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4 text-center hidden md:table-cell">
                                                <p className="text-xs text-slate-500">{new Date(u.createdAt).toLocaleDateString()}</p>
                                            </td>
                                            <td className="px-4 py-4 text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                    <button
                                                        onClick={() => viewUserDetail(u._id)}
                                                        className="p-2 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors"
                                                        title="View Details"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => setRoleModalUser(u)}
                                                        className="p-2 rounded-lg hover:bg-purple-50 text-slate-400 hover:text-purple-600 transition-colors"
                                                        title="Change Role"
                                                    >
                                                        <Shield className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => toggleUserStatus(u._id, u.isActive)}
                                                        className={`p-2 rounded-lg transition-colors ${u.isActive ? 'hover:bg-red-50 text-slate-400 hover:text-red-600' : 'hover:bg-emerald-50 text-slate-400 hover:text-emerald-600'}`}
                                                        title={u.isActive ? 'Deactivate' : 'Activate'}
                                                    >
                                                        {u.isActive ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Pagination */}
                    {pages > 1 && (
                        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100">
                            <p className="text-xs text-slate-500">Page {page} of {pages}</p>
                            <div className="flex gap-2">
                                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-2 rounded-lg bg-slate-50 hover:bg-slate-100 disabled:opacity-40 transition-colors">
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages} className="p-2 rounded-lg bg-slate-50 hover:bg-slate-100 disabled:opacity-40 transition-colors">
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </motion.div>

                {/* User Detail Modal */}
                {selectedUser && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setSelectedUser(null)}>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full max-h-[80vh] overflow-y-auto shadow-2xl"
                            onClick={e => e.stopPropagation()}
                        >
                            {detailLoading ? (
                                <div className="text-center py-12">
                                    <div className="w-8 h-8 border-2 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto" />
                                </div>
                            ) : userDetail ? (
                                <div className="space-y-6">
                                    <div className="flex items-center gap-4">
                                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-400 to-blue-500 flex items-center justify-center text-white text-2xl font-bold">
                                            {userDetail.user?.name?.[0]?.toUpperCase()}
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-bold text-[#1a1a1a]">{userDetail.user?.name}</h2>
                                            <p className="text-sm text-slate-500">{userDetail.user?.email}</p>
                                            <span className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${getRoleBadge(userDetail.user?.role)}`}>
                                                {userDetail.user?.role}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="p-3 bg-slate-50 rounded-xl">
                                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Reports</p>
                                            <p className="text-xl font-bold text-[#1a1a1a]">{userDetail.reportCount || 0}</p>
                                        </div>
                                        <div className="p-3 bg-slate-50 rounded-xl">
                                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Joined</p>
                                            <p className="text-sm font-semibold text-[#1a1a1a]">{new Date(userDetail.user?.createdAt).toLocaleDateString()}</p>
                                        </div>
                                    </div>

                                    {userDetail.user?.profile && (
                                        <div className="space-y-2">
                                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Profile</h3>
                                            <div className="grid grid-cols-2 gap-2 text-sm">
                                                {userDetail.user.profile.age && <div className="p-2 bg-slate-50 rounded-lg"><span className="text-slate-500">Age:</span> <span className="font-medium">{userDetail.user.profile.age}</span></div>}
                                                {userDetail.user.profile.gender && <div className="p-2 bg-slate-50 rounded-lg"><span className="text-slate-500">Gender:</span> <span className="font-medium capitalize">{userDetail.user.profile.gender}</span></div>}
                                                {userDetail.user.profile.weight && <div className="p-2 bg-slate-50 rounded-lg"><span className="text-slate-500">Weight:</span> <span className="font-medium">{userDetail.user.profile.weight} kg</span></div>}
                                                {userDetail.user.profile.height && <div className="p-2 bg-slate-50 rounded-lg"><span className="text-slate-500">Height:</span> <span className="font-medium">{userDetail.user.profile.height} cm</span></div>}
                                            </div>
                                        </div>
                                    )}

                                    {userDetail.activity?.length > 0 && (
                                        <div className="space-y-2">
                                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Recent Activity</h3>
                                            <div className="space-y-2 max-h-[200px] overflow-y-auto">
                                                {userDetail.activity.map((a, i) => (
                                                    <div key={i} className="flex items-center gap-3 p-2.5 bg-slate-50 rounded-xl">
                                                        <Activity className="w-4 h-4 text-slate-400 shrink-0" />
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium text-[#1a1a1a] truncate">{a.title}</p>
                                                            <p className="text-[10px] text-slate-500">{new Date(a.date).toLocaleDateString()}</p>
                                                        </div>
                                                        <span className="text-[10px] font-bold uppercase text-slate-400">{a.status}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <button onClick={() => setSelectedUser(null)} className="w-full py-3 bg-slate-900 text-white rounded-xl font-medium text-sm hover:bg-slate-800 transition-colors">
                                        Close
                                    </button>
                                </div>
                            ) : null}
                        </motion.div>
                    </div>
                )}
                {/* Role Change Modal */}
                {roleModalUser && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setRoleModalUser(null)}>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            className="bg-white rounded-[32px] p-8 max-w-sm w-full shadow-2xl border border-slate-100"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="text-center mb-8">
                                <div className="w-16 h-16 rounded-3xl bg-purple-50 flex items-center justify-center mx-auto mb-4">
                                    <Shield className="w-8 h-8 text-purple-600" />
                                </div>
                                <h2 className="text-xl font-bold text-[#1a1a1a]">Change User Role</h2>
                                <p className="text-sm text-slate-500 mt-2">Adjust permissions for <b>{roleModalUser.name}</b></p>
                            </div>

                            <div className="space-y-3">
                                {['patient', 'client', 'doctor', 'admin'].map((role) => (
                                    <button
                                        key={role}
                                        onClick={() => handleRoleChange(roleModalUser._id, role)}
                                        disabled={updatingRole || roleModalUser.role === role}
                                        className={`w-full py-4 px-6 rounded-2xl text-sm font-bold flex items-center justify-between border-2 transition-all ${
                                            roleModalUser.role === role 
                                            ? 'bg-purple-50 border-purple-500 text-purple-700' 
                                            : 'bg-white border-slate-100 text-slate-600 hover:border-purple-200 hover:bg-slate-50'
                                        } disabled:opacity-50`}
                                    >
                                        <span className="capitalize">{role}</span>
                                        {roleModalUser.role === role && <UserCheck className="w-4 h-4" />}
                                    </button>
                                ))}
                            </div>

                            <button 
                                onClick={() => setRoleModalUser(null)}
                                className="w-full mt-8 py-4 text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                Cancel
                            </button>
                        </motion.div>
                    </div>
                )}
            </div>
        </div>
    );
}
