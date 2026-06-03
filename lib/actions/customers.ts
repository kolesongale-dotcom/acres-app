"use server";

import { prisma } from "@/lib/prisma";
import { generateNextCustomerId } from "@/lib/idGenerator";
import { ActionResult } from "@/lib/types";
import { revalidatePath } from "next/cache";

export interface CustomerInput {
  firstName: string;
  lastName: string;
  company?: string;
  email?: string;
  phone?: string;
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  leadSource?: string;
  status?: string;
  notes?: string;
}

export async function createCustomer(
  input: CustomerInput
): Promise<ActionResult<{ id: number }>> {
  try {
    if (!input.firstName?.trim() && !input.lastName?.trim() && !input.company?.trim()) {
      return { success: false, error: "Enter a first/last name or a company." };
    }
    const existing = await prisma.customer.findMany({
      select: { customerNumber: true },
    });
    const customerNumber = generateNextCustomerId(
      existing.map((c) => c.customerNumber)
    );

    const customer = await prisma.customer.create({
      data: {
        customerNumber,
        firstName: input.firstName?.trim() ?? "",
        lastName: input.lastName?.trim() ?? "",
        company: input.company?.trim() ?? "",
        email: input.email?.trim() ?? "",
        phone: input.phone?.trim() ?? "",
        street: input.street?.trim() ?? "",
        city: input.city?.trim() ?? "",
        state: input.state?.trim() || "PA",
        zip: input.zip?.trim() ?? "",
        leadSource: input.leadSource || "Unknown",
        status: input.status || "lead",
        notes: input.notes ?? "",
      },
    });

    revalidatePath("/customers");
    revalidatePath("/dashboard");
    return { success: true, data: { id: customer.id } };
  } catch (e) {
    console.error(e);
    return { success: false, error: "Failed to create customer." };
  }
}

export async function updateCustomer(
  id: number,
  input: Partial<CustomerInput>
): Promise<ActionResult> {
  try {
    await prisma.customer.update({
      where: { id },
      data: {
        ...(input.firstName !== undefined && { firstName: input.firstName.trim() }),
        ...(input.lastName !== undefined && { lastName: input.lastName.trim() }),
        ...(input.company !== undefined && { company: input.company.trim() }),
        ...(input.email !== undefined && { email: input.email.trim() }),
        ...(input.phone !== undefined && { phone: input.phone.trim() }),
        ...(input.street !== undefined && { street: input.street.trim() }),
        ...(input.city !== undefined && { city: input.city.trim() }),
        ...(input.state !== undefined && { state: input.state.trim() || "PA" }),
        ...(input.zip !== undefined && { zip: input.zip.trim() }),
        ...(input.leadSource !== undefined && { leadSource: input.leadSource }),
        ...(input.status !== undefined && { status: input.status }),
        ...(input.notes !== undefined && { notes: input.notes }),
      },
    });
    revalidatePath("/customers");
    revalidatePath(`/customers/${id}`);
    revalidatePath("/dashboard");
    return { success: true };
  } catch (e) {
    console.error(e);
    return { success: false, error: "Failed to update customer." };
  }
}

export async function deleteCustomer(id: number): Promise<ActionResult> {
  try {
    await prisma.customer.delete({ where: { id } });
    revalidatePath("/customers");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (e) {
    console.error(e);
    return { success: false, error: "Failed to delete customer." };
  }
}
