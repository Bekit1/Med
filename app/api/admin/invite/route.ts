import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { apiError } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  try {
    // Auth check — must be admin
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return apiError("Не авторизован", "AUTH_REQUIRED", 401);
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return apiError("Доступ запрещён", "FORBIDDEN", 403);
    }

    // Parse request
    const { email, full_name } = await req.json();

    if (!email || typeof email !== "string") {
      return apiError("Email обязателен", "VALIDATION_ERROR", 400);
    }

    // Use service_role client to create user
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      console.error("[admin/invite] SUPABASE_SERVICE_ROLE_KEY is not set");
      return apiError("Сервис приглашений не настроен", "SERVICE_ERROR", 500);
    }

    const adminClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Check if user already exists
    const { data: existingUsers } = await adminClient.auth.admin.listUsers();
    const alreadyExists = existingUsers?.users?.some(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );

    if (alreadyExists) {
      return apiError("Пользователь с таким email уже существует", "CONFLICT", 409);
    }

    // Invite user via Supabase (sends magic link email)
    const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: { full_name: full_name || null },
    });

    if (inviteError) {
      console.error("[admin/invite] Invite error:", inviteError);
      return apiError(inviteError.message || "Ошибка при приглашении", "SERVICE_ERROR", 500);
    }

    // If profile wasn't auto-created by trigger, create it
    if (inviteData?.user) {
      const { error: profileError } = await adminClient
        .from("profiles")
        .upsert({
          id: inviteData.user.id,
          full_name: full_name || null,
          role: "member",
        }, { onConflict: "id" });

      if (profileError) {
        console.error("[admin/invite] Profile upsert error:", profileError);
      }
    }

    return NextResponse.json({
      message: `Приглашение отправлено на ${email}`,
    });
  } catch (err) {
    console.error("[admin/invite] Unexpected error:", err);
    return apiError("Внутренняя ошибка сервера", "SERVICE_ERROR", 500);
  }
}
