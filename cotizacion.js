'use strict';

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('propuestaForm');
    if(!form) return;
    const submitBtn = form.querySelector('#btnGenerarDocx');
    const docxLoader = document.getElementById('docxLoader');
    const fijoInputs = form.querySelectorAll('input.fijo');
    const formatPeso = (v) => {
        const num = parseInt((v || '').replace(/\D/g, '')); 
        if (isNaN(num)) return '';
        return '$' + num.toLocaleString('es-CL') + '.-';
    };
    fijoInputs.forEach(inp => {
        inp.addEventListener('blur', () => {
            inp.value = formatPeso(inp.value);
        });
        inp.addEventListener('focus', () => {
            inp.value = inp.value.replace(/[^0-9]/g,'');
        });
    });

    // Solo se necesita PizZip para reemplazar etiquetas en el DOCX
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if(submitBtn) submitBtn.disabled = true;
        if(docxLoader) docxLoader.classList.remove('oculto');
        const datos = Object.fromEntries(new FormData(form).entries());
        const usuario = JSON.parse(localStorage.getItem('usuarioActual') || '{}');
        if (!datos.fecha) {
            datos.fecha = new Date().toISOString().slice(0, 10);
        }

        const cotizacion = Array.from({ length: 4 }, (_, i) => ({
            concepto: datos[`concepto${i + 1}`],
            fijo: datos[`fijo${i + 1}`],
            variable: datos[`variable${i + 1}`]
        }));

        try {
            let numero = 0;
            if (window.supabaseSync?.nextQuoteNumber) {
                numero = await window.supabaseSync.nextQuoteNumber(290);
            }
            if (!Number.isFinite(numero) || numero < 290) {
                throw new Error('No se pudo obtener correlativo desde base de datos');
            }

            const propuestas = JSON.parse(localStorage.getItem('propuestas')) || [];
            const propuesta = { ...datos, cotizacion, numero };
            propuestas.push(propuesta);
            localStorage.setItem('propuestas', JSON.stringify(propuestas));

            const fechaParts = datos.fecha ? datos.fecha.split('-') : [];
            const fechaFormateada =
                fechaParts.length === 3
                    ? `${fechaParts[2]}-${fechaParts[1]}-${fechaParts[0]}`
                    : datos.fecha;
            let resumen = datos.servicio ? datos.servicio.trim() : '';
            if (resumen.endsWith('.')) resumen = resumen.slice(0, -1);

            const replacements = {
                '\\[Nombre cliente\\]': datos.nombre,
                '\\[Mail\\]': datos.mail,
                '\\[Materia\\]': datos.materia,
                '\\[Fecha\\]': fechaFormateada,
                '\\[Servicio requerido\\]': resumen,
                '\\[Propuesta de servicio\\]': datos.propuesta,
                '\\[N\u00famero\\]': numero,
                '\\[Numero\\]': numero,
                '\\[Usuario\\]': usuario.usuario || usuario.nombre || ''
            };

            cotizacion.forEach((c, i) => {
                replacements[`\\[Concepto ${i + 1}\\]`] = c.concepto || '';
                replacements[`\\[Fijo ${i + 1}\\]`] = c.fijo;
                replacements[`\\[Variable ${i + 1}\\]`] = c.variable;
            });

            const resp = await fetch('templatepropuesta.docx');
            if(!resp.ok) throw new Error('template_missing');
            const buffer = await resp.arrayBuffer();
            const zip = new PizZip(buffer);
            let docXml = zip.file('word/document.xml').asText();
            for (const [pattern, value] of Object.entries(replacements)) {
                docXml = docXml.replace(new RegExp(pattern, 'g'), value || '');
            }
            zip.file('word/document.xml', docXml);
            const blob = zip.generate({type:'blob', mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `N${numero} ${datos.nombre}.docx`;
            document.body.appendChild(link);
            link.click();
            if (window.mostrarAlertaModal) {
                window.mostrarAlertaModal(
                    'Cotizaci\u00f3n generada satisfactoriamente. \u00a1Recuerda subirla a <strong>Google Drive</strong>!',
                    'https://drive.google.com/drive/folders/1FBctJ8BlyM6twOBn_xRw8R_mW8xsqBPj'
                );
            }
            setTimeout(() => {
                URL.revokeObjectURL(link.href);
                document.body.removeChild(link);
            }, 100);

            form.reset();
        } catch (err) {
            console.error(err);
            const msg = String(err?.message || "");
            if (window.mostrarToast) {
                window.mostrarToast(
                    msg.includes('correlativo')
                        ? 'No se pudo obtener el correlativo desde base de datos.'
                        : 'No se pudo generar el DOCX.',
                    '#e53935'
                );
            } else {
                alert(msg.includes('correlativo')
                    ? 'No se pudo obtener el correlativo desde base de datos.'
                    : 'No se pudo generar el DOCX.');
            }
        } finally {
            if(submitBtn) submitBtn.disabled = false;
            if(docxLoader) docxLoader.classList.add('oculto');
        }
    });
});
