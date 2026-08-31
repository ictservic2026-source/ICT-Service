const SUPABASE_URL =
    'https://dcsjvursqnvhcwbeqzmd.supabase.co';

/*
 * เอา ANON KEY ตัวเดียวกับ auth.js ของคุณมาใส่ตรงนี้
 */
const SUPABASE_ANON_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjc2p2dXJzcW52aGN3YmVxem1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExNDY0NTYsImV4cCI6MjA5NjcyMjQ1Nn0.IZyMbPMY3Vk8sIM5n8pqBzFoNRlJPpCKitJwgsnc_Hg';


const supabaseClient =
    window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_ANON_KEY
    );


const monthInput =
    document.getElementById('reportMonth');

const loadButton =
    document.getElementById('loadReportBtn');

const statusMessage =
    document.getElementById('statusMessage');

const resultContainer =
    document.getElementById('resultContainer');


/*
 * ตั้งเดือนปัจจุบันเป็นค่าเริ่มต้น
 */
const now = new Date();

const currentMonth =
    now.getFullYear() +
    '-' +
    String(now.getMonth() + 1).padStart(2, '0');

monthInput.value = currentMonth;


/*
 * เมื่อกดปุ่มดึงข้อมูล
 */
loadButton.addEventListener(
    'click',
    loadMonthlyReport
);


async function loadMonthlyReport() {

    const selectedMonth =
        monthInput.value;

    if (!selectedMonth) {

        alert('กรุณาเลือกเดือนก่อน');

        return;
    }


    loadButton.disabled = true;

    loadButton.textContent =
        'กำลังดึงข้อมูล...';

    resultContainer.innerHTML = '';

    statusMessage.textContent =
        'กำลังดึงข้อมูลจาก Supabase...';


    try {

        /*
         * --------------------------------
         * คำนวณวันเริ่มต้น / วันสิ้นสุด
         * --------------------------------
         */

        const startDate =
            `${selectedMonth}-01`;

        const [year, month] =
            selectedMonth
                .split('-')
                .map(Number);

        const nextMonth =
            month === 12
                ? `${year + 1}-01-01`
                : `${year}-${String(month + 1).padStart(2, '0')}-01`;


        /*
         * --------------------------------
         * 1. ดึง Tickets
         * --------------------------------
         */

        const {
            data: tickets,
            error: ticketsError
        } = await supabaseClient
            .from('tickets')
            .select('*')
            .gte(
                'request_date',
                `${startDate}T00:00:00`
            )
            .lt(
                'request_date',
                `${nextMonth}T00:00:00`
            )
            .order(
                'request_date',
                {
                    ascending: true
                }
            );


        if (ticketsError) {

            throw new Error(
                'ดึง tickets ไม่สำเร็จ: ' +
                ticketsError.message
            );
        }


        /*
         * ถ้าไม่มี Ticket
         */

        if (!tickets || tickets.length === 0) {

            showEmpty();

            return;
        }


        /*
         * --------------------------------
         * 2. ดึงข้อมูล Services
         * --------------------------------
         */

        const ticketNos =
            tickets.map(
                ticket => ticket.ticket_no
            );


        const {
            data: services,
            error: servicesError
        } = await supabaseClient
            .from('ticket_services')
            .select('*')
            .in(
                'ticket_no',
                ticketNos
            );


        if (servicesError) {

            throw new Error(
                'ดึง ticket_services ไม่สำเร็จ: ' +
                servicesError.message
            );
        }


        /*
         * --------------------------------
         * 3. ดึง Logs
         * --------------------------------
         */

        const {
            data: logs,
            error: logsError
        } = await supabaseClient
            .from('tickets_log')
            .select('*')
            .in(
                'ticket_no',
                ticketNos
            )
            .order(
                'created_at',
                {
                    ascending: true
                }
            );


        if (logsError) {

            throw new Error(
                'ดึง tickets_log ไม่สำเร็จ: ' +
                logsError.message
            );
        }


        /*
         * --------------------------------
         * 4. ดึง Survey
         * --------------------------------
         */

        const {
            data: surveys,
            error: surveysError
        } = await supabaseClient
            .from('ticket_survey')
            .select('*')
            .in(
                'ticket_no',
                ticketNos
            );


        if (surveysError) {

            throw new Error(
                'ดึง ticket_survey ไม่สำเร็จ: ' +
                surveysError.message
            );
        }


        /*
         * --------------------------------
         * เตรียมข้อมูลให้ค้นง่าย
         * --------------------------------
         */

        const serviceMap =
            new Map();

        (services || []).forEach(
            service => {

                serviceMap.set(
                    service.ticket_no,
                    service
                );

            }
        );


        const logMap =
            new Map();

        (logs || []).forEach(
            log => {

                if (!logMap.has(log.ticket_no)) {

                    logMap.set(
                        log.ticket_no,
                        []
                    );
                }

                logMap
                    .get(log.ticket_no)
                    .push(log);

            }
        );


        const surveyMap =
            new Map();

        (surveys || []).forEach(
            survey => {

                surveyMap.set(
                    survey.ticket_no,
                    survey
                );

            }
        );


        /*
         * --------------------------------
         * แสดงผล
         * --------------------------------
         */

        renderTickets(
            tickets,
            serviceMap,
            logMap,
            surveyMap
        );


        /*
         * --------------------------------
         * สรุป
         * --------------------------------
         */

        updateSummary(
            tickets,
            services || []
        );


        statusMessage.textContent =
            `ดึงข้อมูลสำเร็จ พบ ${tickets.length} Ticket`;


    } catch (error) {

        console.error(error);

        statusMessage.textContent =
            'เกิดข้อผิดพลาด: ' +
            error.message;

        statusMessage.style.background =
            '#fee2e2';

        statusMessage.style.color =
            '#991b1b';

    } finally {

        loadButton.disabled = false;

        loadButton.textContent =
            '🔍 ดึงข้อมูล';

    }

}


/*
 * ==========================================
 * SUMMARY
 * ==========================================
 */

function updateSummary(
    tickets,
    services
) {

    let totalImages = 0;

    let totalAttachments = 0;


    tickets.forEach(ticket => {

        if (
            Array.isArray(
                ticket.issue_img_url
            )
        ) {

            totalImages +=
                ticket.issue_img_url.length;

        }


        if (
            Array.isArray(
                ticket.attachment_url
            )
        ) {

            totalAttachments +=
                ticket.attachment_url.length;

        }

    });


    services.forEach(service => {

        if (
            Array.isArray(
                service.attachment_urls
            )
        ) {

            totalAttachments +=
                service.attachment_urls.length;

        }

    });


    document.getElementById(
        'totalTickets'
    ).textContent =
        tickets.length;


    document.getElementById(
        'totalImages'
    ).textContent =
        totalImages;


    document.getElementById(
        'totalAttachments'
    ).textContent =
        totalAttachments;


    document.getElementById(
        'totalServices'
    ).textContent =
        services.length;

}


/*
 * ==========================================
 * RENDER TICKETS
 * ==========================================
 */

function renderTickets(
    tickets,
    serviceMap,
    logMap,
    surveyMap
) {

    resultContainer.innerHTML = '';


    tickets.forEach(ticket => {

        const service =
            serviceMap.get(
                ticket.ticket_no
            );


        const logs =
            logMap.get(
                ticket.ticket_no
            ) || [];


        const survey =
            surveyMap.get(
                ticket.ticket_no
            );


        const card =
            document.createElement('div');

        card.className =
            'ticket-card';


        card.innerHTML = `

            <div class="ticket-header">

                <div class="ticket-no">
                    ${escapeHtml(
                        ticket.ticket_no
                    )}
                </div>

                <div class="ticket-status">
                    ${escapeHtml(
                        ticket.status || '-'
                    )}
                </div>

            </div>


            <div class="ticket-body">


                <div class="info-grid">

                    ${infoItem(
                        'วันที่แจ้ง',
                        formatDate(
                            ticket.request_date
                        )
                    )}

                    ${infoItem(
                        'ผู้แจ้ง',
                        ticket.requester_name
                    )}

                    ${infoItem(
                        'แผนก',
                        ticket.department
                    )}

                    ${infoItem(
                        'สถานที่',
                        ticket.location
                    )}

                    ${infoItem(
                        'Asset',
                        ticket.asset_id
                    )}

                    ${infoItem(
                        'Priority',
                        ticket.priority
                    )}

                </div>


                <div class="file-section">

                    <h3>
                        รายละเอียดปัญหา
                    </h3>

                    <div>
                        ${escapeHtml(
                            ticket.issue_detail ||
                            '-'
                        )}
                    </div>

                </div>


                ${renderImages(
                    ticket.issue_img_url
                )}


                ${renderFiles(
                    '📎 เอกสารแนบ Ticket',
                    ticket.attachment_url
                )}


                ${renderService(
                    service
                )}


                ${renderFiles(
                    '🛠️ เอกสาร/ไฟล์จาก Service',
                    service
                        ? service.attachment_urls
                        : []
                )}


                ${renderSurvey(
                    survey
                )}


                <div class="file-section">

                    <h3>
                        📋 ประวัติการดำเนินงาน
                    </h3>

                    <div>

                        ${renderLogs(logs)}

                    </div>

                </div>


            </div>
        `;


        resultContainer.appendChild(card);

    });

}


/*
 * ==========================================
 * IMAGE
 * ==========================================
 */

function renderImages(images) {

    if (
        !Array.isArray(images) ||
        images.length === 0
    ) {

        return `
            <div class="file-section">
                <h3>🖼️ รูปเคส User</h3>
                <div>ไม่มีรูป</div>
            </div>
        `;

    }


    return `

        <div class="file-section">

            <h3>
                🖼️ รูปเคส User
                (${images.length})
            </h3>

            <div class="image-grid">

                ${images.map(
                    url => `

                    <div class="image-box">

                        <a
                            href="${escapeAttribute(url)}"
                            target="_blank"
                        >

                            <img
                                src="${escapeAttribute(url)}"
                                alt="Ticket Image"
                                loading="lazy"
                            >

                        </a>

                    </div>

                `
                ).join('')}

            </div>

        </div>

    `;

}


/*
 * ==========================================
 * FILES
 * ==========================================
 */

function renderFiles(
    title,
    files
) {

    if (
        !Array.isArray(files) ||
        files.length === 0
    ) {

        return '';

    }


    return `

        <div class="file-section">

            <h3>
                ${title}
                (${files.length})
            </h3>

            <div class="file-list">

                ${files.map(
                    url => {

                        const name =
                            getFileName(url);

                        return `

                            <a
                                class="file-item"
                                href="${escapeAttribute(url)}"
                                target="_blank"
                            >
                                📎
                                ${escapeHtml(name)}
                            </a>

                        `;

                    }
                ).join('')}

            </div>

        </div>

    `;

}


/*
 * ==========================================
 * SERVICE
 * ==========================================
 */

function renderService(service) {

    if (!service) {

        return '';

    }


    return `

        <div class="service-box">

            <h3>
                🛠️ Service
            </h3>

            <div class="service-grid">

                ${serviceItem(
                    'เจ้าหน้าที่',
                    service.staff_name
                )}

                ${serviceItem(
                    'วันที่รับงาน',
                    service.received_date
                )}

                ${serviceItem(
                    'วันที่เสร็จ',
                    service.finish_date
                )}

                ${serviceItem(
                    'ประเภทงาน',
                    service.job_category
                )}

                ${serviceItem(
                    'ค่าใช้จ่าย',
                    service.repair_cost
                )}

                ${serviceItem(
                    'Work Hours',
                    service.work_hours
                )}

            </div>


            <div class="file-section">

                <h3>
                    รายละเอียดการตรวจสอบ
                </h3>

                <div>
                    ${escapeHtml(
                        service.inspection_detail ||
                        '-'
                    )}
                </div>

            </div>


            <div class="file-section">

                <h3>
                    การดำเนินการ
                </h3>

                <div>
                    ${escapeHtml(
                        service.action_detail ||
                        '-'
                    )}
                </div>

            </div>

        </div>

    `;

}


/*
 * ==========================================
 * SURVEY
 * ==========================================
 */

function renderSurvey(survey) {

    if (!survey) {

        return '';

    }


    return `

        <div class="file-section">

            <h3>
                ⭐ Survey
            </h3>

            <div class="info-grid">

                ${infoItem(
                    'คะแนนรวม',
                    survey.score_total
                )}

                ${infoItem(
                    'แก้ไขสำเร็จ',
                    survey.chk_resolved
                        ? 'ใช่'
                        : 'ไม่ใช่'
                )}

                ${infoItem(
                    'อธิบายงาน',
                    survey.chk_explained
                        ? 'ใช่'
                        : 'ไม่ใช่'
                )}

            </div>


            <div>

                ${escapeHtml(
                    survey.comment || '-'
                )}

            </div>

        </div>

    `;

}


/*
 * ==========================================
 * LOG
 * ==========================================
 */

function renderLogs(logs) {

    if (
        !logs ||
        logs.length === 0
    ) {

        return '<div>ไม่มี Log</div>';

    }


    return logs.map(
        log => `

            <div class="info-item">

                <label>
                    ${formatDate(
                        log.created_at
                    )}
                </label>

                <div>
                    ${escapeHtml(
                        log.step_name || '-'
                    )}
                    /
                    ${escapeHtml(
                        log.status || '-'
                    )}
                    /
                    ${escapeHtml(
                        log.action_by || '-'
                    )}
                </div>

                <div>
                    ${escapeHtml(
                        log.comment || ''
                    )}
                </div>

            </div>

        `
    ).join('');

}


/*
 * ==========================================
 * HELPERS
 * ==========================================
 */

function infoItem(
    label,
    value
) {

    return `

        <div class="info-item">

            <label>
                ${escapeHtml(label)}
            </label>

            <div>
                ${escapeHtml(
                    value ?? '-'
                )}
            </div>

        </div>

    `;

}


function serviceItem(
    label,
    value
) {

    return `

        <div class="service-item">

            <label>
                ${escapeHtml(label)}
            </label>

            <div>
                ${escapeHtml(
                    value ?? '-'
                )}
            </div>

        </div>

    `;

}


function formatDate(value) {

    if (!value) {

        return '-';

    }

    const date =
        new Date(value);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return value;

    }

    return date.toLocaleString(
        'th-TH',
        {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        }
    );

}


function getFileName(url) {

    try {

        const clean =
            url.split('?')[0];

        return decodeURIComponent(
            clean
                .split('/')
                .pop()
        );

    } catch {

        return 'ไฟล์แนบ';

    }

}


function escapeHtml(value) {

    return String(
        value ?? ''
    )
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

}


function escapeAttribute(value) {

    return escapeHtml(value);

}


function showEmpty() {

    resultContainer.innerHTML = `

        <div class="empty">

            ไม่พบ Ticket ในเดือนที่เลือก

        </div>

    `;

    document.getElementById(
        'totalTickets'
    ).textContent = '0';

    document.getElementById(
        'totalImages'
    ).textContent = '0';

    document.getElementById(
        'totalAttachments'
    ).textContent = '0';

    document.getElementById(
        'totalServices'
    ).textContent = '0';

}