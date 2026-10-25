import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import PDFDocument = require('pdfkit');
import { create, type Font } from 'fontkit';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CareDocumentSnapshot } from './care-document.types';

type PdfFont = { name: string; bytes: Buffer; metrics: Font };
let fonts: PdfFont[] | undefined;
function documentFonts() {
  if (!fonts)
    fonts = [
      'NotoSans-Regular',
      'NotoSans-Bold',
      'NotoSansDevanagari-Regular',
      'NotoSansGurmukhi-Regular',
      'NotoSansTamil-Regular',
      'NotoSansBengali-Regular',
    ].map((name) => {
      const bytes = readFileSync(join(__dirname, 'fonts', `${name}.ttf`));
      return { name, bytes, metrics: create(bytes) as Font };
    });
  return fonts;
}
const color = {
  ink: '#10283A',
  muted: '#566977',
  teal: '#0D7870',
  line: '#D6E1E4',
};
const clean = (text: string) =>
  text
    .replace(/\r\n?/g, '\n')
    .replace(/\t/g, '    ')
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/[\u00a0\u202f]/g, ' ');
function date(value: string) {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T12:00:00Z`));
}
function timestamp(value: string) {
  return (
    clean(
      new Intl.DateTimeFormat('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Asia/Kolkata',
      }).format(new Date(value))
    ) + ' IST'
  );
}

/** Static vector/text PDFs. User-entered strings are text, never interpreted as markup or links. */
@Injectable()
export class CarePdfRenderer {
  render(snapshot: CareDocumentSnapshot): Promise<Buffer> {
    const available = documentFonts();
    const regular = available[0],
      bold = available[1];
    const title =
      snapshot.kind === 'prescription' ? 'Prescription' : 'Visit summary';
    const left = 48,
      width = 499.28;
    const doc = new PDFDocument({
      size: 'A4',
      autoFirstPage: false,
      bufferPages: true,
      margins: { top: 92, bottom: 66, left, right: left },
      info: {
        Title: `${snapshot.platform.name} - ${title}`,
        Author: snapshot.dentist.name,
        Subject: `${title} for appointment ${snapshot.appointment.id}`,
        CreationDate: new Date(snapshot.capturedAt),
        ModDate: new Date(snapshot.capturedAt),
        Creator: 'Dentra',
      },
    });
    available.forEach((font) => doc.registerFont(font.name, font.bytes));

    function runs(text: string, strong: boolean) {
      const result: { font: PdfFont; text: string }[] = [];
      for (const character of clean(text)) {
        const code = character.codePointAt(0)!;
        const previous = result[result.length - 1]?.font;
        const preferred = strong ? bold : regular;
        const font =
          (/[\s\u200c\u200d]/u.test(character) && previous) ||
          (preferred.metrics.hasGlyphForCodePoint(code) && preferred) ||
          available.find((candidate) =>
            candidate.metrics.hasGlyphForCodePoint(code)
          );
        if (!font)
          throw new UnprocessableEntityException(
            'Some saved characters cannot be displayed in this PDF. Please contact support.'
          );
        if (result[result.length - 1]?.font === font)
          result[result.length - 1].text += character;
        else result.push({ font, text: character });
      }
      return result;
    }
    function text(
      value: string,
      size = 10.5,
      strong = false,
      fill = color.ink
    ) {
      const segments = runs(value || 'Not recorded', strong);
      doc.fontSize(size).fillColor(fill);
      segments.forEach((segment, index) => {
        doc
          .font(segment.font.name)
          .text(segment.text, {
            width,
            lineGap: 3,
            continued: index < segments.length - 1,
          });
      });
      doc.x = left;
    }
    function space(points = 10) {
      doc.y += points;
    }
    function ensure(points: number) {
      if (doc.y + points > doc.page.height - doc.page.margins.bottom)
        doc.addPage();
    }
    function section(label: string) {
      ensure(68);
      space(12);
      text(label.toUpperCase(), 9, true, color.teal);
      space(6);
    }
    function field(label: string, value: string | null | undefined) {
      ensure(42);
      text(label, 8.5, true, color.muted);
      text(value?.trim() || 'Not recorded');
      space(8);
    }
    function medicines() {
      const rx = snapshot.prescription;
      if (!rx?.items.length) {
        text(
          'No signed prescription is available for this visit.',
          10,
          false,
          color.muted
        );
        return;
      }
      rx.items.forEach((medicine, index) => {
        ensure(94);
        text(
          `${index + 1}. ${medicine.medicineName}${
            medicine.strength ? ` - ${medicine.strength}` : ''
          }`,
          11,
          true
        );
        space(3);
        text(`Dose: ${medicine.dose || 'Not recorded'}`);
        text(`Frequency: ${medicine.frequency || 'Not recorded'}`);
        text(`Duration: ${medicine.duration || 'Not recorded'}`);
        if (medicine.instructions?.trim())
          text(`Instructions: ${medicine.instructions}`);
        space(12);
      });
    }
    function confirmation() {
      const rx = snapshot.prescription;
      if (!rx) return;
      section('Dentist confirmation');
      text(snapshot.dentist.name, 11, true);
      text(`Council registration: ${snapshot.dentist.councilRegNo}`);
      text(
        `Confirmed using a signing code on ${timestamp(rx.signedAt)}.`,
        9,
        false,
        color.muted
      );
      text(`Prescription reference: ${rx.id}`, 8.5, false, color.muted);
    }

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      try {
        doc.on('pageAdded', () => {
          if (doc.bufferedPageRange().count > 100)
            throw new UnprocessableEntityException(
              'This record is too long to export as a single PDF. Please contact support.'
            );
        });
        doc.addPage();
        text(title, 25, true);
        space(6);
        text(
          `${
            snapshot.appointment.type === 'video'
              ? 'Video consultation'
              : 'In-clinic visit'
          } | ${date(snapshot.appointment.date)} | ${
            snapshot.appointment.time
          } IST`,
          10,
          false,
          color.muted
        );
        section('Patient');
        text(snapshot.patient.name, 13, true);
        text(
          `DOB: ${date(snapshot.patient.dateOfBirth)} | Age at visit: ${
            snapshot.patient.age
          }${snapshot.patient.gender ? ` | ${snapshot.patient.gender}` : ''}`,
          9.5,
          false,
          color.muted
        );
        section('Treating dentist');
        text(
          `${snapshot.dentist.name} | ${snapshot.dentist.qualification}`,
          11,
          true
        );
        text(
          `${snapshot.dentist.specialization} | Council registration: ${snapshot.dentist.councilRegNo}`,
          9.5
        );
        if (snapshot.clinic) {
          text(snapshot.clinic.name, 10);
          if (snapshot.clinic.address)
            text(snapshot.clinic.address, 9.5, false, color.muted);
          if (snapshot.clinic.phone)
            text(
              `Clinic contact: ${snapshot.clinic.phone}`,
              9.5,
              false,
              color.muted
            );
        }

        if (snapshot.kind === 'prescription') {
          section('Prescription medicines');
          medicines();
          confirmation();
        } else {
          section('Clinical note');
          field('Reason for visit', snapshot.consultation.chiefComplaint);
          field('Examination findings', snapshot.consultation.findings);
          field('Diagnosis', snapshot.consultation.diagnosis);
          field('Treatment done', snapshot.consultation.treatmentDone);
          section('Treatment plan');
          field('Plan and advice', snapshot.consultation.plan);
          for (const [index, item] of (snapshot.consultation.planItems ?? []).entries()) {
            ensure(94);
            text(`${index + 1}. ${item.procedure}`, 10, true);
            text(item.teeth.length ? `Teeth: ${item.teeth.join(', ')}` : 'General treatment', 9.5);
            if (item.estimatedCostPaise != null)
              text(`Estimated cost: INR ${(item.estimatedCostPaise / 100).toFixed(2)}`, 9.5);
            else text('Cost not estimated', 9.5, false, color.muted);
            space(6);
          }
          const pricedProcedures = (snapshot.consultation.planItems ?? []).filter(item => item.estimatedCostPaise != null);
          if (pricedProcedures.length) {
            ensure(54);
            const total = pricedProcedures.reduce((sum, item) => sum + item.estimatedCostPaise!, 0);
            text(`Estimated total: INR ${(total / 100).toFixed(2)}`, 10, true);
            if (pricedProcedures.length < snapshot.consultation.planItems!.length)
              text('Some procedures do not have an estimate.', 9, false, color.muted);
            space(8);
          }
          field(
            'Follow-up',
            snapshot.consultation.followUpDate
              ? date(snapshot.consultation.followUpDate)
              : 'No follow-up date recorded'
          );
          if (snapshot.chart.length) {
            section('Dental chart updates');
            snapshot.chart.forEach((entry) =>
              text(`Tooth ${entry.tooth}: ${entry.status}`)
            );
          }
          section('Prescription');
          medicines();
          if (snapshot.prescription) confirmation();
          if (snapshot.appointment.completedAt) {
            space(8);
            text(
              `Visit completed: ${timestamp(snapshot.appointment.completedAt)}`,
              9,
              false,
              color.muted
            );
          }
          if (snapshot.consultation.isEdited && snapshot.consultation.editedAt)
            text(
              `Record updated: ${timestamp(snapshot.consultation.editedAt)}`,
              9,
              false,
              color.muted
            );
        }
        section('Record reference');
        text(
          `Appointment: ${snapshot.appointment.id}`,
          8.5,
          false,
          color.muted
        );
        text(
          `Document snapshot: ${timestamp(snapshot.capturedAt)}`,
          8.5,
          false,
          color.muted
        );
        if (snapshot.source === 'legacy-export')
          text(
            'Historical record: profile details were captured at the first PDF export.',
            8.5,
            false,
            color.muted
          );
        if (snapshot.platform.supportEmail)
          text(
            `Support: ${snapshot.platform.supportEmail}`,
            8.5,
            false,
            color.muted
          );

        const pages = doc.bufferedPageRange();
        for (let page = 0; page < pages.count; page++) {
          doc.switchToPage(page);
          doc.rect(0, 0, doc.page.width, 5).fill(color.teal);
          const brand = runs(snapshot.platform.name, true);
          doc.fontSize(14).fillColor(color.teal);
          doc.x = left;
          doc.y = 29;
          brand.forEach((segment, index) =>
            doc
              .font(segment.font.name)
              .text(segment.text, {
                width: 300,
                height: 44,
                ellipsis: true,
                continued: index < brand.length - 1,
              })
          );
          doc
            .font(regular.name)
            .fontSize(9)
            .fillColor(color.muted)
            .text(title, 370, 33, {
              width: doc.page.width - 370 - left,
              align: 'right',
            });
          doc
            .moveTo(left, 73)
            .lineTo(doc.page.width - left, 73)
            .strokeColor(color.line)
            .stroke();
          const y = doc.page.height - 43;
          doc
            .moveTo(left, y - 9)
            .lineTo(doc.page.width - left, y - 9)
            .strokeColor(color.line)
            .stroke();
          doc
            .font(regular.name)
            .fontSize(7.5)
            .fillColor(color.muted)
            .text(
              'Private care record - patient and treating dentist',
              left,
              y,
              { lineBreak: false }
            )
            .text(
              `Page ${page + 1} of ${pages.count}`,
              doc.page.width - left - 70,
              y,
              { lineBreak: false }
            );
        }
        doc.end();
      } catch (error) {
        doc.destroy();
        reject(error);
      }
    });
  }
}
