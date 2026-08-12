import enum, datetime
from sqlalchemy import Column, String, Text, DateTime, JSON, Integer, BigInteger, Enum as SQLEnum, create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.pool import NullPool
from app.config import settings

Base = declarative_base()

_is_sqlite = settings.database_url.startswith("sqlite")
_kwargs = {}
if _is_sqlite:
    # NullPool = tanpa batas koneksi (anti "QueuePool limit reached")
    _kwargs = {"connect_args": {"check_same_thread": False, "timeout": 60}, "poolclass": NullPool}
engine = create_engine(settings.database_url, **_kwargs)

if _is_sqlite:
    @event.listens_for(engine, "connect")
    def _set_sqlite_pragma(dbapi_conn, record):
        cur = dbapi_conn.cursor()
        cur.execute("PRAGMA journal_mode=WAL")    # baca & tulis bisa paralel
        cur.execute("PRAGMA busy_timeout=60000")  # jangan langsung nyerah kalau ke-lock
        cur.close()

SessionLocal = sessionmaker(bind=engine)

class ProjectStatus(str, enum.Enum):
    queued = "queued"; downloading = "downloading"; transcribing = "transcribing"
    generating = "generating"; done = "done"; failed = "failed"

class Project(Base):
    __tablename__ = "projects"
    id = Column(String, primary_key=True)
    source_type = Column(String, default="youtube")
    source_url = Column(String, nullable=True)
    language = Column(String, default="id")
    tone = Column(String, default="casual")
    status = Column(SQLEnum(ProjectStatus), default=ProjectStatus.queued)
    transcript = Column(Text)
    results = Column(JSON)
    error = Column(Text)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    user_id = Column(String, nullable=True)
class PaymentStatus(str, enum.Enum):
    pending = "pending"
    success = "success"
    failed = "failed"
    expired = "expired"
class Payment(Base):
    __tablename__ = "payments"
    id = Column(String, primary_key=True)       # order_id unik
    user_id = Column(String, index=True)
    package = Column(String)                     # starter/basic/pro/premium
    amount = Column(BigInteger)                  # dalam rupiah
    credits = Column(Integer)                    # jumlah kredit yang dibeli
    snap_token = Column(String, nullable=True)
    status = Column(SQLEnum(PaymentStatus), default=PaymentStatus.pending)
    midtrans_id = Column(String, nullable=True)  # transaction_id dari Midtrans
    paid_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True)
    email = Column(String, unique=True, index=True)
    name = Column(String, nullable=True)
    password_hash = Column(String, nullable=True)   # null untuk user Google
    credits = Column(Integer, default=3)            # 🪙 freemium: 3 kredit gratis
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


