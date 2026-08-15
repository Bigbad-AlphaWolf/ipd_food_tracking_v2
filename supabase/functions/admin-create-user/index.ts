// Lets an org admin or platform administrator provision a brand-new user
// (email + temporary password + role(s) + organization(s)) from the app.
//
// This has to run server-side: auth.admin.createUser() requires the service
// role key, which must never reach the browser. The caller's own JWT is used
// only to look up their profile and decide what they're allowed to do;
// everything privileged (the profile lookup and the user creation itself)
// goes through a service-role client.
//
// Deployed via the Supabase MCP tool (`deploy_edge_function`) — there is no
// local Supabase CLI workflow for this project (see CLAUDE.md).

import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const ALLOWED_ROLES = ['admin', 'employee', 'platform_administrator', 'meal_coordinator'];

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405);
  }

  const authHeader = req.headers.get('Authorization');

  if (!authHeader) {
    return json({ error: 'missing_authorization' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  // Scoped to the caller's own JWT — only used to identify who is calling.
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } }
  });

  const {
    data: { user: caller },
    error: callerError
  } = await callerClient.auth.getUser();

  if (callerError || !caller) {
    return json({ error: 'unauthorized' }, 401);
  }

  // Service-role client for every privileged read/write from here on.
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: callerProfile, error: callerProfileError } = await adminClient
    .from('profiles')
    .select('roles, role, is_active')
    .eq('id', caller.id)
    .single();

  if (callerProfileError || !callerProfile || !callerProfile.is_active) {
    return json({ error: 'unauthorized' }, 403);
  }

  const callerRoles: string[] =
    Array.isArray(callerProfile.roles) && callerProfile.roles.length > 0
      ? callerProfile.roles
      : callerProfile.role
        ? [callerProfile.role]
        : [];

  const callerIsPlatformAdmin = callerRoles.includes('platform_administrator');
  const callerIsOrgAdmin = callerRoles.includes('admin');

  if (!callerIsPlatformAdmin && !callerIsOrgAdmin) {
    return json({ error: 'forbidden' }, 403);
  }

  let payload: {
    email?: string;
    password?: string;
    fullName?: string;
    department?: string | null;
    phoneNumber?: string | null;
    roles?: string[];
    organizationIds?: string[];
  };

  try {
    payload = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const email = payload.email?.trim().toLowerCase();
  const password = payload.password;
  const fullName = payload.fullName?.trim() ?? '';
  const requestedRoles = Array.isArray(payload.roles) ? payload.roles.filter((role) => ALLOWED_ROLES.includes(role)) : [];
  const requestedOrganizationIds = Array.isArray(payload.organizationIds) ? payload.organizationIds : [];

  if (!email || !email.includes('@')) {
    return json({ error: 'invalid_email' }, 400);
  }

  if (!password || password.length < 6) {
    return json({ error: 'invalid_password' }, 400);
  }

  if (requestedRoles.length === 0) {
    return json({ error: 'roles_required' }, 400);
  }

  const requestsPlatformAdmin = requestedRoles.includes('platform_administrator');

  if (!callerIsPlatformAdmin) {
    // Org admins may not grant platform_administrator, and may only assign
    // organizations they themselves belong to.
    if (requestsPlatformAdmin) {
      return json({ error: 'forbidden_role' }, 403);
    }

    const { data: callerMemberships, error: membershipError } = await adminClient
      .from('organization_members')
      .select('organization_id')
      .eq('profile_id', caller.id);

    if (membershipError) {
      return json({ error: membershipError.message }, 500);
    }

    const allowedOrganizationIds = new Set((callerMemberships ?? []).map((row) => row.organization_id));
    const outOfScope = requestedOrganizationIds.some((id) => !allowedOrganizationIds.has(id));

    if (requestedOrganizationIds.length === 0 || outOfScope) {
      return json({ error: 'forbidden_organization' }, 403);
    }
  }

  if (!requestsPlatformAdmin && requestedOrganizationIds.length === 0) {
    return json({ error: 'organization_required' }, 400);
  }

  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      department: payload.department?.trim() || null,
      phone_number: payload.phoneNumber?.trim() || null,
      role: requestedRoles.includes('admin') || requestsPlatformAdmin ? 'admin' : 'employee',
      roles: requestedRoles,
      organization_ids: requestsPlatformAdmin ? [] : requestedOrganizationIds,
      must_change_password: true
    }
  });

  if (createError) {
    return json({ error: createError.message }, 400);
  }

  return json({ id: created.user?.id }, 200);
});
